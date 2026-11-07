
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import pg from "pg";

const { Client } = pg;

export const runtime = "nodejs";

const MAX_WORDS = 250;
const OVERLAP_WORDS = 40;
const EMBEDDING_BATCH_SIZE = 10;

function normalize(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\b([A-Za-z]+) (ffi|fi|fl|ff) ([A-Za-z]+)\b/g, "$1$2$3")
    .replace(/\b(ffi|fi|fl|ff) ([a-z]+)\b/g, "$1$2")
    .replace(/([,.;:])(?=[A-Za-z])/g, "$1 ")
    .trim();
}

function chunkPage(text: string, pageNumber: number) {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + MAX_WORDS, words.length);

    chunks.push({
      page_number: pageNumber,
      chunk_index: chunks.length,
      text: words.slice(start, end).join(" "),
    });

    if (end === words.length) break;

    start = end - OVERLAP_WORDS;
  }

  return chunks;
}

export async function POST(request: Request) {
  let client;
  let transactionStarted = false;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a file." },
        { status: 400 }
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be smaller than 15 MB." },
        { status: 400 }
      );
    }

    const filename = file.name.toLowerCase();

    const isPdf =
      filename.endsWith(".pdf") ||
      file.type === "application/pdf";

    const isDocx =
      filename.endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        { error: "Only PDF and DOCX files are supported." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // STEP 1: Extract text while preserving PDF pages.
    const pages: { page_number: number; text: string }[] = [];

    if (isPdf) {
      const pdfjs = await import(
        /* webpackIgnore: true */
        "pdfjs-dist/legacy/build/pdf.mjs"
      );

      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        disableFontFace: true,
      }).promise;

      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");

        pages.push({ page_number: pageNumber, text });
      }

      await pdf.destroy();
    } else {
      const result = await mammoth.extractRawText({ buffer });

      pages.push({
        page_number: 1,
        text: result.value,
      });
    }

    // STEP 2: Create chunks.
    const chunks = pages.flatMap((page) =>
      chunkPage(page.text, page.page_number)
    );

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No readable text found in this document." },
        { status: 400 }
      );
    }

    // STEP 3: Check environment variables.
    const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const databaseUrl = process.env.DATABASE_URL;

    if (!acct || !token || !databaseUrl) {
      throw new Error("Missing required environment variables.");
    }

    // STEP 4: Connect to PostgreSQL.
    client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    // STEP 5: Create document record.
    const documentResult = await client.query(
      `INSERT INTO documents (filename)
       VALUES ($1)
       RETURNING id`,
      [file.name]
    );

    const documentId = documentResult.rows[0].id;

    // STEP 6: Generate embeddings and save chunks.
    const embeddingUrl =
      `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/baai/bge-base-en-v1.5`;

    let insertedChunks = 0;

    for (
      let i = 0;
      i < chunks.length;
      i += EMBEDDING_BATCH_SIZE
    ) {
      const batch = chunks.slice(
        i,
        i + EMBEDDING_BATCH_SIZE
      );

      const embeddingResponse = await fetch(embeddingUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: batch.map((chunk) => chunk.text),
        }),
      });

      const embeddingBody = await embeddingResponse.json();

      if (
        !embeddingResponse.ok ||
        !embeddingBody.success ||
        !Array.isArray(embeddingBody.result?.data)
      ) {
        throw new Error("Cloudflare embedding generation failed.");
      }

      const vectors = embeddingBody.result.data;

      if (vectors.length !== batch.length) {
        throw new Error("Embedding count does not match chunk count.");
      }

      for (let j = 0; j < batch.length; j++) {
        const vector = vectors[j];

        if (
          !Array.isArray(vector) ||
          vector.length !== 768 ||
          !vector.every(
            (value: number) =>
              typeof value === "number" && Number.isFinite(value)
          )
        ) {
          throw new Error("Invalid 768-dimensional embedding.");
        }

        await client.query(
          `INSERT INTO chunks
           (document_id, page_number, chunk_index, text, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)`,
          [
            documentId,
            batch[j].page_number,
            batch[j].chunk_index,
            batch[j].text,
            JSON.stringify(vector),
          ]
        );

        insertedChunks++;
      }
    }

    // STEP 7: Commit database transaction.
    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      message: "Document uploaded and indexed successfully.",
      filename: file.name,
      document_id: documentId,
      total_chunks: insertedChunks,
      total_pages: pages.length,
    });

  } catch (error) {
    console.error("Upload and indexing error:", error);

    if (client && transactionStarted) {
      await client.query("ROLLBACK").catch(console.error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process document.",
      },
      { status: 500 }
    );

  } finally {
    if (client) {
      await client.end().catch(console.error);
    }
  }
}

