// Оновлення бази даних з base64 зображеннями
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://klqxadvtvxvizgdjmegx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhhZHZ0dnh2aXpnZGptZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzI3ODEsImV4cCI6MjA4NjIwODc4MX0.ev6yogjEETj3X49_KSBjt9FIxloQsB8kDbpjutUioQ8';

const BASE64_FILE = path.join(__dirname, 'table-content-base64.json');

async function main() {
  console.log('=== Оновлення бази даних з base64 ===\n');

  // Читаємо base64 контент
  if (!fs.existsSync(BASE64_FILE)) {
    console.error('Файл table-content-base64.json не знайдено!');
    process.exit(1);
  }

  const updates = JSON.parse(fs.readFileSync(BASE64_FILE, 'utf8'));
  console.log(`Знайдено ${updates.length} секцій для оновлення\n`);

  let success = 0;
  let failed = 0;

  for (const update of updates) {
    try {
      console.log(`Оновлення секції ${update.id}...`);

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/guide_sections?id=eq.${update.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ content: update.content })
        }
      );

      if (response.ok) {
        console.log(`  ✓ Успішно`);
        success++;
      } else {
        const error = await response.text();
        console.log(`  ✗ Помилка: ${response.status} ${error.substring(0, 200)}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ✗ Помилка: ${err.message}`);
      failed++;
    }

    // Невелика пауза між запитами
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n=== Готово! ===`);
  console.log(`Успішно: ${success}`);
  console.log(`Помилок: ${failed}`);
}

main().catch(console.error);
