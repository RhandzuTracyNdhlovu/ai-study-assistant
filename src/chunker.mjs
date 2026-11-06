import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const [pdfPath = 'test.pdf', outputPath = 'chunks.json'] = process.argv.slice(2);
const MAX_WORDS = 250;
const OVERLAP_WORDS = 40;
const pdfjsImport = process.env.PDFJS_MODULE_PATH || 'pdfjs-dist/legacy/build/pdf.mjs';
const pdfjs = await import(pdfjsImport.match(/^[A-Za-z]:\\|^\//) ? pathToFileURL(pdfjsImport) : pdfjsImport);
const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableFontFace: true }).promise;

function normalize(items) {
  return items.map(item => item.str).join(' ').replace(/\s+/g, ' ')
    .replace(/\b([A-Za-z]+) (ffi|fi|fl|ff) ([A-Za-z]+)\b/g, '$1$2$3')
    .replace(/\b(ffi|fi|fl|ff) ([a-z]+)\b/g, '$1$2')
    .replace(/([,.;:])(?=[A-Za-z])/g, '$1 ')
    .replaceAll('headerfields', 'header fields')
    .replaceAll('headerfield', 'header field')
    .replaceAll('responsefields', 'response fields')
    .replaceAll('responsefield', 'response field')
    .replaceAll('logfile', 'log file')
    .trim();
}

function chunkPage(text, pageNumber) {
  const words = text.split(/\s+/).filter(Boolean);
  const pageChunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + MAX_WORDS, words.length);
    pageChunks.push({
      page_number: pageNumber,
      chunk_index: pageChunks.length,
      text: words.slice(start, end).join(' '),
    });
    if (end === words.length) break;
    start = end - OVERLAP_WORDS;
  }
  return pageChunks;
}

const chunks = [];
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
  const page = await pdf.getPage(pageNumber);
  const text = normalize((await page.getTextContent()).items);
  chunks.push(...chunkPage(text, pageNumber));
}
fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2), 'utf8');
const page14 = chunks.filter(chunk => chunk.page_number === 14);
const words = text => text.trim().split(/\s+/).filter(Boolean);
const maxChunkWords = Math.max(...chunks.map(chunk => words(chunk.text).length));
console.log(JSON.stringify({
  pdf_pages: pdf.numPages,
  chunks: chunks.length,
  chunk_limit_words: MAX_WORDS,
  overlap_words: OVERLAP_WORDS,
  largest_chunk_words: maxChunkWords,
  page_14_chunk_0_first_200_chars: page14.find(chunk => chunk.chunk_index === 0)?.text.slice(0, 200),
  page_14_chunk_1_first_200_chars: page14.find(chunk => chunk.chunk_index === 1)?.text.slice(0, 200),
}, null, 2));
