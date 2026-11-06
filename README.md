# AI Study Assistant (Chat with Your Notes)

MentorTechz internship, Project 3. A retrieval-augmented (RAG) prototype: it indexes a PDF, finds the passages that match a question, and answers from them with page citations.

**Status: working command-line prototype with partial scope. It is not the full feature list.**

## What works
- Page-aware PDF chunking: 250 words max, 40-word overlap, chunks never cross a page.
- Embeddings from Cloudflare Workers AI (`@cf/baai/bge-base-en-v1.5`), 768 dimensions (measured from a real response).
- Storage and cosine-distance search in Neon Postgres with pgvector.
- Answers built from the 5 nearest chunks with page citations, plus a "not found" cutoff.

## What is not built
- DOCX upload, web interface (Next.js), subject library, chat history, summaries, flashcards, quizzes, export.
- Only pages 12-24 of the test PDF are indexed (28 of 393 chunks). This keeps the first end-to-end test small and finishes before the deadline. A planning estimate in docs/cloudflare-neuron-budget.md suggests the whole document would fit in the free daily allowance, but I did not measure it.

## Test document
RFC 9110, HTTP Semantics (June 2022, 194 pages): https://www.rfc-editor.org/rfc/rfc9110.pdf

## Setup
Requirements: Node.js 20.6 or newer, a free Neon Postgres project with pgvector, a Cloudflare account with a Workers AI API token.

1. `npm install`
2. Save the RFC as `test.pdf` (PDFs are git-ignored), then `npm run chunk` to write `chunks.json` (also git-ignored).
3. Create a `.env` file with `DATABASE_URL`, `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Never commit it.
4. Run `sql/schema.sql` in the Neon SQL Editor.
5. `node --env-file=.env load-chunks.mjs` embeds and stores pages 12-24 (edit `FIRST_PAGE` and `LAST_PAGE` in the script to load more).
6. `node --env-file=.env answer.mjs "What is a user agent?"`

Other scripts: `ask.mjs` prints the nearest chunks and distances (for debugging retrieval); `embed-test.mjs` checks the embedding API and prints the vector length.

## How it works
1. The chunker splits each page into chunks and keeps the page number.
2. Each chunk is embedded and stored with its page number in Postgres.
3. A question is embedded with the same model; pgvector returns the 5 nearest chunks.
4. If the best distance is above 0.40, the app answers "I can't find that in your document" and does not call the chat model.
5. Otherwise the chunks go to a chat model (`@cf/zai-org/glm-4.7-flash`) with instructions to answer only from them and cite pages like [p. 14].

## Test results
The full question list is in docs/test-questions.md.

| Question | Expected page | Pages retrieved (in order) | Best distance | Outcome |
|---|---|---|---|---|
| What does the HTTP uniform interface let clients do? | 14 | 13, 19, 19, 12, 14 | 0.241 | Expected page ranked 5th. Answer cited pp. 12, 13, 14; its key phrases were found on the cited pages. |
| How does RFC 9110 define a resource...? | 18 | 18, 23, 18, 19, 19 | 0.230 | Right page first. Generated answer not reviewed. |
| What is a user agent...? | 20 | 20, 20, 13, 16, 22 | 0.158 | Right page first. Generated answer not reviewed. |
| Paraphrase of the uniform-interface question | 14 | 14, 18, 19 (top 3 only) | not recorded | Right page first. |
| How can HTTP communicate a resource's state without transferring the resource? | 18 | 19, 19, 13, 18, 14 | 0.244 | Expected page ranked 4th. Answer cited p. 18. |
| What is the capital of France? | none | 20, 19, 18 (top 3 only) | 0.556 | Rejected by the cutoff. |
| What is the boiling point of water? | none | 15, 15, 16, 14, 18 | 0.457 | Rejected by the cutoff. |
| What is the best Python embedding model? | none | 18, 15, 14, 19, 24 | 0.396 | Passed the cutoff by 0.004; the chat model itself answered that it could not find it. |
| How does HTTP/2 multiplex streams over one connection? | none (index has pp. 12-24) | 19, 19, 13, 21, 13 | 0.295 | Passed the cutoff. Answer cited p. 13, which mentions HTTP/2 briefly. The answer was thin. |

## Findings
- Retrieving 5 chunks mattered: the expected page ranked 4th and 5th for two questions, so a top-3 search would have missed both.
- On-topic best distances were 0.158 to 0.244; off-topic ones were 0.396 to 0.556. A cutoff near 0.35 would sit between those ranges, but I kept 0.40 and have not retuned it.
- Distance measures how close the topic is, not whether the answer is present. The prompt instruction to say "not found" is a second safety layer, and it worked once (the Python question).

## Known limitations
- The cutoff is based on a handful of questions.
- Citations come from the model. I checked key phrases for one answer only; citations are not guaranteed correct.
- Chunk text includes page headers and footers from the PDF.
- Document text is placed inside the model prompt. A malicious document could attempt prompt injection; the prompt tells the model to treat excerpts as data, which reduces but does not remove the risk.
- Cloudflare neuron usage for loading and for answering was not measured. Workers AI models can be retired.
- `npm run chunk` and `chunks.json` came from the Day One work; I have not re-run the chunker on my own machine.
- npm reported 1 high-severity vulnerability when installing `pg`; I have not reviewed it. The `pg` library also prints an SSL-mode warning that I have not acted on.

## Security
`.env` is git-ignored (checked with `git check-ignore -v .env`) and no secrets are committed.

## AI assistance
The Day One chunker (src/chunker.mjs), its verification script (src/verify-chunks.mjs) and src/cloudflare-embeddings.mjs were generated with OpenAI Codex. Claude (Anthropic) acted as my mentor: it wrote embed-test.mjs, load-chunks.mjs, ask.mjs and answer.mjs, drafted this README, and explained the design as we went. I ran embed-test.mjs, load-chunks.mjs, ask.mjs and answer.mjs on my own machine, set up Node, Git and the repository, and recorded the test results above. I have not yet re-run the Codex-generated chunker myself.

## What I learned
I learned how a PDF question-answering system works from document text to retrieval: split text into page-aware chunks, create embeddings, store them in pgvector, and retrieve relevant passages for a question. The 40-word overlap helps preserve context between chunks, and keeping page numbers lets answers include citations. I also learned that retrieval needs careful checking: the right page can rank below other results, and a similarity cutoff can reject some off-topic questions while still letting a partially related question through.

I confirmed that Neon could enable pgvector on my free project, and that the embedding array’s length determines the vector(N) size in the schema. I learned to keep .env out of Git before staging files, and to report clearly which parts I ran, which I built with AI assistance, and which still need verification. One thing I still need to measure is the actual Workers AI neuron usage for my embedding batch.