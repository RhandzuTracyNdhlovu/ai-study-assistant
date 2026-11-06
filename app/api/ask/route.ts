
import { NextResponse } from "next/server";
import pg from "pg";

const { Client } = pg;

export async function POST(request: Request) {
  let client;

  try {
    const { question } = await request.json();

    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 }
      );
    }

    const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const databaseUrl = process.env.DATABASE_URL;

    if (!acct || !token || !databaseUrl) {
      throw new Error("Missing environment variables.");
    }

    // STEP 1: Generate question embedding
    const embeddingResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/baai/bge-base-en-v1.5`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: [question] }),
      }
    );

    const embeddingBody = await embeddingResponse.json();

    if (!embeddingResponse.ok || !embeddingBody.success) {
      throw new Error("Could not generate question embedding.");
    }

    const qVec = JSON.stringify(embeddingBody.result.data[0]);

    // STEP 2: Retrieve relevant document chunks
    client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    const { rows } = await client.query(
      `SELECT page_number, chunk_index, text,
       embedding <=> $1::vector AS distance
       FROM chunks
       ORDER BY embedding <=> $1::vector
       LIMIT 8`,
      [qVec]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        answer: "I could not find relevant information in your study document.",
        sources: [],
      });
    }

    // STEP 3: Prepare document context
    const context = rows.map((row, index) =>
      `Source ${index + 1} - Page ${row.page_number}:\n${row.text}`
    ).join("\n\n");

    // STEP 4: Generate an AI answer
    const aiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/google/gemma-4-26b-a4b-it`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are an AI Study Assistant. Answer questions clearly and accurately using only the supplied study document. Explain concepts in simple language. If the document does not contain the answer, say so. Include the relevant page numbers in your answer. Do not invent information."
            },
            {
              role: "user",
              content:
                `Question: ${question}\n\nStudy document:\n${context}\n\nProvide a helpful explanation with page references.`
            }
          ]
        }),
      }
    );

    const aiBody = await aiResponse.json();

    if (!aiResponse.ok || !aiBody.success) {
      console.error("AI generation error:", aiBody);
      throw new Error("AI answer generation failed.");
    }

  // STEP 5: Return answer and sources
return NextResponse.json({
  question,
  answer: aiBody.result?.response || "The AI could not generate an answer. Please try again.",
  sources: rows.map(row => ({
    page_number: row.page_number,
    chunk_index: row.chunk_index,
    distance: Number(row.distance),
    text: row.text,
  })),
});

  } catch (error) {
    conanswer: aiBody.result.response,ole.error("Study Assistant error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Something went wrong."
      },
      { status: 500 }
    );

  } finally {
    if (client) {
      await client.end().catch(console.error);
    }
  }
}
