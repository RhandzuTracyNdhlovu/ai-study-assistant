import pg from "pg";
const { DATABASE_URL, CLOUDFLARE_ACCOUNT_ID: acct, CLOUDFLARE_API_TOKEN: token } = process.env;
const question = process.argv.slice(2).join(" ");
if (!question) throw new Error('Usage: node --env-file=.env ask.mjs "your question"');

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/baai/bge-base-en-v1.5`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ text: [question] }),
});
const body = await res.json();
if (!body.success) throw new Error("Embedding failed: " + JSON.stringify(body.errors));
const qVec = JSON.stringify(body.result.data[0]);

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  `SELECT page_number, chunk_index, embedding <=> $1::vector AS distance, left(text, 160) AS preview
   FROM chunks ORDER BY embedding <=> $1::vector LIMIT 8`, [qVec]);
await client.end();
for (const r of rows) console.log(`page ${r.page_number} (chunk ${r.chunk_index}) distance ${Number(r.distance).toFixed(3)}\n  ${r.preview.replace(/\s+/g, " ")}\n`);
console.log('SUMMARY', rows.map(r => r.page_number + ':' + Number(r.distance).toFixed(3)).join(' '));
