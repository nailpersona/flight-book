// Оновлення бази даних з JSON файлом через REST API
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://klqxadvtvxvizgdjmegx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhhZHZ0dnh2aXpnZGptZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzI3ODEsImV4cCI6MjA4NjIwODc4MX0.ev6yogjEETj3X49_KSBjt9FIxloQsB8kDbpjutUioQ8';

const UPDATES_FILE = path.join(__dirname, 'table-content-updates.json');

async function main() {
  const updates = JSON.parse(fs.readFileSync(UPDATES_FILE, 'utf8'));
  console.log(`Оновлення ${updates.length} секцій...\n`);

  let success = 0;
  let failed = 0;

  for (const update of updates) {
    try {
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
        console.log(`✓ Оновлено секцію ${update.id}`);
        success++;
      } else {
        const error = await response.text();
        console.log(`✗ Помилка ${update.id}: ${response.status} ${error}`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ Помилка ${update.id}: ${err.message}`);
      failed++;
    }

    // Невелика пауза між запитами
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nГотово! Успішно: ${success}, Помилок: ${failed}`);
}

main().catch(console.error);
