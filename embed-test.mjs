import fs from "fs";
const { CLOUDFLARE_ACCOUNT_ID: acct, CLOUDFLARE_API_TOKEN: token } = process.env;
if (!acct || !token) throw new Error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN first");
const chunks = JSON.parse(fs.readFileSync("chunks.json", "utf8")).slice(0, 10);
const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/baai/bge-base-en-v1.5`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ text: chunks.map(c => c.text) }),
});
console.log("status:", res.status);
const body = await res.json();
console.log("top-level keys:", Object.keys(body));
console.log("success:", body.success, "errors:", JSON.stringify(body.errors));
const data = body.result?.data;
console.log("vectors returned:", data?.length, "| length of first vector (N):", data?.[0]?.length);