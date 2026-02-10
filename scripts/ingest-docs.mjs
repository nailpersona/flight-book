/**
 * Document Ingest Script
 * Parses documents from docs/, chunks text, generates embeddings, stores in Supabase.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/ingest-docs.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.join(__dirname, '..', 'docs');

const SUPABASE_URL = 'https://klqxadvtvxvizgdjmegx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhhZHZ0dnh2aXpnZGptZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzI3ODEsImV4cCI6MjA4NjIwODc4MX0.ev6yogjEETj3X49_KSBjt9FIxloQsB8kDbpjutUioQ8';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('ERROR: Set OPENAI_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Document definitions ---
const DOCUMENTS = [
  {
    title: 'КБП ВА 2022',
    sourceFile: 'KBP-VA-2022.txt',
    type: 'txt',
  },
  {
    title: 'КЛПВ-24',
    sourceFile: 'KLPV-24.md',
    type: 'md',
  },
  {
    title: 'ПЛВР (Положення про ЛВР)',
    sourceFile: 'PLVR.md',
    type: 'md',
  },
  {
    title: 'ПВП ДАУ',
    sourceFile: 'PVP-DAU.md',
    type: 'md',
  },
  {
    title: 'КБП БА/РА 2021',
    sourceFile: 'КБП_БА_РА_2021_+08.12_ДОФ_09.12.docx',
    type: 'docx',
  },
  // КБП-В-2018 folder — each .doc file
  {
    title: 'КБП-В-2018 — Зміст',
    sourceFile: 'КБП-В-2018/Зміст КБП.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — Зворот',
    sourceFile: 'КБП-В-2018/Зворот.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — 1,2 Задача',
    sourceFile: 'КБП-В-2018/1, 2 ЗАДАЧА.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — 1,2 Програма',
    sourceFile: 'КБП-В-2018/1,2 ПРОГРАМА.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — 3,4 Програма',
    sourceFile: 'КБП-В-2018/3, 4  ПРОГРАМА.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — 4-вода, 5 Програма',
    sourceFile: 'КБП-В-2018/4-вода, 5 ПРОГРАМА на затвердження.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — 5 Програма Борттехніки',
    sourceFile: 'КБП-В-2018/5 ПРОГРАМА Борттехніки.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — Програма 6 з ОНВ',
    sourceFile: 'КБП-В-2018/ПРОГРАМА 6 з ОНВ.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — Додаток 2, 3',
    sourceFile: 'КБП-В-2018/ДОДАТКИ/Додаток 2, 3.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — Додаток 4',
    sourceFile: 'КБП-В-2018/ДОДАТКИ/Додаток 4/Додаток 4.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — Додаток 4 (таблиці 5,9,13)',
    sourceFile: 'КБП-В-2018/ДОДАТКИ/Додаток 4/таблиці 5, 9, 13.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — Додаток 5',
    sourceFile: 'КБП-В-2018/ДОДАТКИ/Додаток 5.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — Додаток 6',
    sourceFile: 'КБП-В-2018/ДОДАТКИ/Додаток6.doc',
    type: 'doc',
  },
  {
    title: 'КБП-В-2018 — Додаток 1',
    sourceFile: 'КБП-В-2018/ДОДАТКИ/Додаток 1.xls',
    type: 'xls',
  },
  {
    title: 'КБП-В-2018 — Додаток 1 (морська авіація)',
    sourceFile: 'КБП-В-2018/ДОДАТКИ/Додаток 1 продовження для морської авіації.xls',
    type: 'xls',
  },
];

// --- Text extraction ---

async function extractText(doc) {
  const filePath = path.join(DOCS_DIR, doc.sourceFile);

  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP: file not found — ${doc.sourceFile}`);
    return null;
  }

  switch (doc.type) {
    case 'txt':
    case 'md':
      return fs.readFileSync(filePath, 'utf-8');

    case 'docx': {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    case 'doc': {
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(filePath);
      return extracted.getBody();
    }

    case 'xls': {
      const workbook = XLSX.readFile(filePath);
      let text = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += `\n=== Аркуш: ${sheetName} ===\n`;
        text += XLSX.utils.sheet_to_txt(sheet);
      }
      return text;
    }

    default:
      console.warn(`  SKIP: unknown type — ${doc.type}`);
      return null;
  }
}

// --- Chunking ---

function chunkText(text, maxChars = 2000, overlap = 300) {
  // Clean up text
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  if (text.length <= maxChars) {
    return [text];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;

    if (end < text.length) {
      // Try to break at paragraph boundary
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + maxChars * 0.5) {
        end = paragraphBreak;
      } else {
        // Try sentence boundary
        const sentenceBreak = text.lastIndexOf('. ', end);
        if (sentenceBreak > start + maxChars * 0.5) {
          end = sentenceBreak + 1;
        }
      }
    } else {
      end = text.length;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start < 0) start = 0;
    if (end >= text.length) break;
  }

  return chunks;
}

// --- Embeddings ---

async function generateEmbeddings(texts) {
  const BATCH_SIZE = 50;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: batch,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const embeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
    allEmbeddings.push(...embeddings);

    if (i + BATCH_SIZE < texts.length) {
      console.log(`    Embeddings: ${allEmbeddings.length}/${texts.length}`);
      await sleep(500);
    }
  }

  return allEmbeddings;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main ---

async function main() {
  console.log('=== Document Ingest ===\n');

  // Clear existing data
  console.log('Clearing existing data...');
  await supabase.from('document_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Done.\n');

  let totalChunks = 0;

  for (const doc of DOCUMENTS) {
    console.log(`Processing: ${doc.title}`);

    // 1. Extract text
    const text = await extractText(doc);
    if (!text || text.trim().length < 50) {
      console.log(`  Skipped (empty or too short)\n`);
      continue;
    }
    console.log(`  Text extracted: ${text.length} chars`);

    // 2. Insert document record
    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        title: doc.title,
        source_file: doc.sourceFile,
        document_type: doc.type,
        content: text.slice(0, 50000), // store first 50k chars
        metadata: { original_length: text.length },
      })
      .select()
      .single();

    if (docError) {
      console.error(`  ERROR inserting document: ${docError.message}`);
      continue;
    }

    // 3. Chunk text
    const chunks = chunkText(text);
    console.log(`  Chunks: ${chunks.length}`);

    // 4. Generate embeddings
    console.log(`  Generating embeddings...`);
    const embeddings = await generateEmbeddings(chunks);

    // 5. Insert chunks with embeddings
    const chunkRows = chunks.map((chunk, i) => ({
      document_id: docRecord.id,
      chunk_text: chunk,
      chunk_index: i,
      paragraph_ref: null,
      embedding: JSON.stringify(embeddings[i]),
    }));

    // Insert in batches of 100
    for (let i = 0; i < chunkRows.length; i += 100) {
      const batch = chunkRows.slice(i, i + 100);
      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert(batch);

      if (chunkError) {
        console.error(`  ERROR inserting chunks: ${chunkError.message}`);
      }
    }

    totalChunks += chunks.length;
    console.log(`  Done.\n`);
  }

  console.log(`=== Ingest complete: ${totalChunks} chunks total ===`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
