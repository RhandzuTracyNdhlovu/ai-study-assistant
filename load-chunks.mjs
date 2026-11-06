import fs from "fs";
import pg from "pg";

const { DATABASE_URL, CLOUDFLARE_ACCOUNT_ID: acct, CLOUDFLARE_API_TOKEN: token } = process.env;
if (!DATABASE_URL || !acct || !token) throw new Error("Missing a value in .env");

const FIRST_PAGE = 12, LAST_PAGE = 24;
const chunks = JSON.parse(fs.readFileSync("chunks.json", "utf8"))
  .filter(c => c.page_number >= FIRST_PAGE && c.page_number <= LAST_PAGE);
console.log("chunks to load:", chunks.length);

async function embed(texts) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/baai/bge-base-en-v1.5`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: texts }),
    }
  );
  const body = await res.json();
  if (!body.success) throw new Error("Embedding failed: " + JSON.stringify(body.errors));
  return body.result.data;
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  "INSERT INTO documents (filename) VALUES ($1) RETURNING id", ["rfc9110.pdf"]);
const documentId = rows[0].id;

const BATCH = 10;
for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);
  const vectors = await embed(batch.map(c => c.text));
  for (let j = 0; j < batch.length; j++) {
    await client.query(
      "INSERT INTO chunks (document_id, page_number, chunk_index, text, embedding) VALUES ($1,$2,$3,$4,$5::vector)",
      [documentId, batch[j].page_number, batch[j].chunk_index, batch[j].text, JSON.stringify(vectors[j])]
    );
  }
  console.log(`loaded ${Math.min(i + BATCH, chunks.length)} / ${chunks.length}`);
}
await client.end();
console.log("done. document id:", documentId);