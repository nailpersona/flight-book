// Створення bucket та завантаження зображень
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://klqxadvtvxvizgdjmegx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhhZHZ0dnh2aXpnZGptZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzI3ODEsImV4cCI6MjA4NjIwODc4MX0.ev6yogjEETj3X49_KSBjt9FIxloQsB8kDbpjutUioQ8';
const BUCKET_NAME = 'tables';
const IMAGES_DIR = path.join(__dirname, '../public/images/tables');

async function createBucket() {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/bucket`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: BUCKET_NAME,
        public: true
      })
    }
  );

  if (response.ok) {
    console.log(`✓ Bucket "${BUCKET_NAME}" створено`);
    return true;
  } else {
    const error = await response.text();
    console.log(`Bucket creation: ${response.status} ${error}`);
    return false;
  }
}

async function uploadFile(filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  const fileBuffer = fs.readFileSync(filePath);

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filename}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true'
      },
      body: fileBuffer
    }
  );

  if (response.ok) {
    console.log(`✓ ${filename}`);
    return true;
  } else {
    const error = await response.text();
    console.log(`✗ ${filename}: ${response.status} ${error}`);
    return false;
  }
}

async function main() {
  // Спробуємо створити bucket
  await createBucket();

  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.png'));
  console.log(`\nЗавантаження ${files.length} зображень...\n`);

  let success = 0;
  for (const file of files) {
    if (await uploadFile(file)) success++;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nГотово! Успішно: ${success}/${files.length}`);
}

main().catch(console.error);
