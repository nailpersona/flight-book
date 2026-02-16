// Вбудовуємо зображення як base64 в контент бази даних
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://klqxadvtvxvizgdjmegx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhhZHZ0dnh2aXpnZGptZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzI3ODEsImV4cCI6MjA4NjIwODc4MX0.ev6yogjEETj3X49_KSBjt9FIxloQsB8kDbpjutUioQ8';

const IMAGES_DIR = path.join(__dirname, '../public/images/tables');
const UPDATES_FILE = path.join(__dirname, 'table-content-updates.json');

// Читаємо зображення і конвертуємо в base64
function imageToBase64(filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  const fileBuffer = fs.readFileSync(filePath);
  return `data:image/png;base64,${fileBuffer.toString('base64')}`;
}

async function main() {
  console.log('=== Вбудовуємо зображення як base64 ===\n');

  // Читаємо оновлення контенту
  if (!fs.existsSync(UPDATES_FILE)) {
    console.error('Файл table-content-updates.json не знайдено!');
    process.exit(1);
  }

  const updates = JSON.parse(fs.readFileSync(UPDATES_FILE, 'utf8'));
  console.log(`Знайдено ${updates.length} секцій для оновлення\n`);

  // Отримуємо список зображень
  const imageFiles = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.png'));
  console.log(`Знайдено ${imageFiles.length} зображень\n`);

  // Створюємо мапу filename -> base64
  const imageMap = {};
  for (const file of imageFiles) {
    const base64 = imageToBase64(file);
    imageMap[file] = base64;
    console.log(`Конвертовано: ${file} (${Math.round(base64.length / 1024)} KB)`);
  }

  // Оновлюємо контент - замінюємо посилання на зображення на base64
  const updatedSections = [];
  for (const update of updates) {
    let newContent = update.content;

    // Знаходимо всі посилання на зображення і замінюємо на base64
    for (const [filename, base64] of Object.entries(imageMap)) {
      const imgRef = `/images/tables/${filename}`;
      if (newContent.includes(imgRef)) {
        newContent = newContent.replace(imgRef, base64);
        console.log(`Вбудовано ${filename} в секцію ${update.id}`);
      }
    }

    updatedSections.push({
      id: update.id,
      content: newContent
    });
  }

  // Зберігаємо оновлений контент
  const outputPath = path.join(__dirname, 'table-content-base64.json');
  fs.writeFileSync(outputPath, JSON.stringify(updatedSections, null, 2));
  console.log(`\nЗбережено в: ${outputPath}`);

  // Оновлюємо базу даних
  console.log('\n=== Оновлення бази даних ===\n');

  let success = 0;
  let failed = 0;

  for (const update of updatedSections) {
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
        console.log(`✗ Помилка ${update.id}: ${response.status} ${error.substring(0, 100)}`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ Помилка ${update.id}: ${err.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nГотово! Успішно: ${success}, Помилок: ${failed}`);
}

main().catch(console.error);
