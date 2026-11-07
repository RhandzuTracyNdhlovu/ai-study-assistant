
import { NextResponse } from "next/server";
import pg from "pg";

const { Client } = pg;

export const runtime = "nodejs";

export async function POST(request: Request) {
  let client;

  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json(
        { error: "Please enter a study topic." },
        { status: 400 }
      );
    }

    const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const databaseUrl = process.env.DATABASE_URL;

    if (!acct || !token || !databaseUrl) {
      throw new Error("Missing environment variables.");
    }

    // STEP 1: Generate topic embedding
    const embeddingResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/baai/bge-base-en-v1.5`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: [topic] }),
      }
    );

    const embeddingBody = await embeddingResponse.json();

    if (!embeddingResponse.ok || !embeddingBody.success) {
      throw new Error("Could not generate topic embedding.");
    }

    const topicVector = JSON.stringify(
      embeddingBody.result.data[0]
    );

    // STEP 2: Connect to database
    client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    // STEP 3: Retrieve relevant study material
    const { rows } = await client.query(
      `SELECT page_number, chunk_index, text,
       embedding <=> $1::vector AS distance
       FROM chunks
       ORDER BY embedding <=> $1::vector
       LIMIT 8`,
      [topicVector]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No study material found. Please upload a document first.",
        },
        { status: 404 }
      );
    }

    const context = rows
      .map(
        (row, index) =>
          `Source ${index + 1} - Page ${row.page_number}:\n${row.text}`
      )
      .join("\n\n");

    // STEP 4: Generate quiz using Cloudflare AI
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
                'You are a study assistant. Create exactly 6 multiple-choice quiz questions using only the supplied study material. Return valid JSON only, without Markdown or extra text. Format: {"questions":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correctAnswer":"A. ..."}]}. Every question must have exactly 4 different options. correctAnswer must exactly match one of the options. Make questions clear and educational. Do not invent facts.',
            },
            {
              role: "user",
              content:
                `Create a practice quiz about: ${topic}\n\nStudy material:\n${context}`,
            },
          ],
        }),
      }
    );

    const aiBody = await aiResponse.json();

    if (!aiResponse.ok || !aiBody.success) {
      console.error("Quiz AI error:", aiBody);
      throw new Error("Quiz generation failed.");
    }

    // STEP 5: Parse and validate quiz
    const content =
      aiBody.result?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error("The AI returned an invalid response.");
    }

    const jsonText = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");

    if (start === -1 || end === -1) {
      throw new Error("Could not read the generated quiz.");
    }

    const parsed = JSON.parse(
      jsonText.substring(start, end + 1)
    );

    if (
      !Array.isArray(parsed.questions) ||
      parsed.questions.length === 0 ||
      !parsed.questions.every(
        (q: any) =>
          typeof q.question === "string" &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every((option: any) => typeof option === "string") &&
          new Set(q.options).size === 4 &&
          typeof q.correctAnswer === "string" &&
          q.options.includes(q.correctAnswer)
      )
    ) {
      throw new Error("The AI returned invalid quiz questions.");
    }

    // STEP 6: Return quiz
    return NextResponse.json({
      topic,
      questions: parsed.questions,
      sources: rows.map((row) => ({
        page_number: row.page_number,
        chunk_index: row.chunk_index,
        text: row.text,
      })),
    });
  } catch (error) {
    console.error("Quiz error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.end().catch(console.error);
    }
  }
}
