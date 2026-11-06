import fs from 'node:fs';

function loadLocalEnv(path = '.env') {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const split = trimmed.indexOf('=');
    if (split < 1) continue;
    const key = trimmed.slice(0, split).trim();
    const value = trimmed.slice(split + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  }
}
loadLocalEnv();
const [chunksPath = 'chunks.json'] = process.argv.slice(2);
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !apiToken) {
  throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in ignored .env or your local environment. Never paste either secret into chat.');
}
const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf8')).slice(0, 10);
if (chunks.length !== 10) throw new Error(`Expected 10 chunks, found ${chunks.length}`);
const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-base-en-v1.5`;
const response = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: chunks.map(chunk => chunk.text) }),
});
const raw = await response.text();
console.log('FULL WORKERS AI RESPONSE');
console.log(raw);
console.log(`HTTP status: ${response.status}`);
if (!response.ok) throw new Error(`Workers AI request failed with HTTP ${response.status}`);
const payload = JSON.parse(raw);
console.log('Top-level keys:', Object.keys(payload));
console.log('result type:', Array.isArray(payload.result) ? 'array' : typeof payload.result);

const numericArrays = [];
function inspect(value, path = 'response') {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(item => typeof item === 'number' && Number.isFinite(item))) {
      numericArrays.push({ path, length: value.length });
      return;
    }
    value.forEach((item, index) => inspect(item, `${path}[${index}]`));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) inspect(child, `${path}.${key}`);
  }
}
inspect(payload);
console.log('Numeric vector arrays found:', JSON.stringify(numericArrays));
if (numericArrays.length === 0) throw new Error('No numeric embedding array found; inspect the full response above before changing the parser.');
console.log('N (first returned embedding length):', numericArrays[0].length);
