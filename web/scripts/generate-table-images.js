// Скрипт для генерації PNG зображень таблиць з КЛПВ
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klqxadvtvxvizgdjmegx.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const OUTPUT_DIR = path.join(__dirname, '../public/images/tables');

// HTML шаблон для таблиці
const getTableHtml = (markdownTable, title = '') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      padding: 20px;
    }
    h2 {
      font-size: 16px;
      font-weight: 400;
      color: #111827;
      margin-bottom: 16px;
      text-align: center;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #E5E7EB;
      padding: 8px 12px;
      text-align: center;
    }
    th {
      background: #F9FAFB;
      font-weight: 400;
    }
    td {
      background: #FFFFFF;
    }
    tr:nth-child(even) td {
      background: #F9FAFB;
    }
  </style>
</head>
<body>
  ${title ? `<h2>${title}</h2>` : ''}
  ${parseMarkdownTable(markdownTable)}
</body>
</html>
`;

// Парсинг markdown таблиці в HTML
function parseMarkdownTable(markdown) {
  const lines = markdown.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return '<p>Немає даних</p>';

  const rows = [];
  for (const line of lines) {
    if (line.match(/^\|[-\s|:]+\|$/)) continue; // Skip separator
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.length > 0) rows.push(cells);
  }

  if (rows.length === 0) return '<p>Немає даних</p>';

  let html = '<table>\n';
  rows.forEach((row, idx) => {
    const tag = idx === 0 ? 'th' : 'td';
    html += '  <tr>\n';
    row.forEach(cell => {
      // Bold text
      const formatted = cell.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html += `    <${tag}>${formatted}</${tag}>\n`;
    });
    html += '  </tr>\n';
  });
  html += '</table>';
  return html;
}

// Витягування таблиць з markdown контенту
function extractTables(content) {
  const tables = [];
  const lines = content.split('\n');
  let currentTable = [];
  let inTable = false;
  let tableStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableStartIndex = i;
      }
      currentTable.push(line);
    } else {
      if (inTable && currentTable.length > 0) {
        tables.push({
          lines: currentTable.join('\n'),
          startIndex: tableStartIndex,
          endIndex: i - 1
        });
        currentTable = [];
        inTable = false;
      }
    }
  }

  // Остання таблиця
  if (inTable && currentTable.length > 0) {
    tables.push({
      lines: currentTable.join('\n'),
      startIndex: tableStartIndex,
      endIndex: lines.length - 1
    });
  }

  return tables;
}

async function generateTableImage(browser, markdownTable, title, outputPath) {
  const html = getTableHtml(markdownTable, title);
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Отримати розмір контенту
    const bodyHandle = await page.$('body');
    const { width, height } = await bodyHandle.boundingBox();
    await bodyHandle.dispose();

    // Зробити скріншот
    await page.screenshot({
      path: outputPath,
      clip: { x: 0, y: 0, width: Math.ceil(width), height: Math.ceil(height) },
      type: 'png'
    });

    console.log(`  Created: ${path.basename(outputPath)}`);
    return true;
  } catch (err) {
    console.error(`  Error creating ${outputPath}:`, err.message);
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('=== Генерація зображень таблиць КЛПВ ===\n');

  // Створити папку для зображень
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Отримати всі секції з таблицями
  const { data: sections, error } = await supabase
    .from('guide_sections')
    .select('id, title, content')
    .eq('document_id', 3) // КЛПВ
    .like('content', '%|%');

  if (error) {
    console.error('Error fetching sections:', error);
    process.exit(1);
  }

  console.log(`Found ${sections.length} sections with tables\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const updates = [];

  for (const section of sections) {
    console.log(`Processing: ${section.title}`);

    const tables = extractTables(section.content);
    if (tables.length === 0) {
      console.log('  No tables found');
      continue;
    }

    let newContent = section.content;
    let tableIndex = 0;

    for (const table of tables) {
      const filename = `klpv_table_${section.id}_${tableIndex}.png`;
      const outputPath = path.join(OUTPUT_DIR, filename);
      const imageUrl = `/images/tables/${filename}`;

      const success = await generateTableImage(browser, table.lines, '', outputPath);

      if (success) {
        // Замінити markdown таблицю на зображення
        const beforeTable = newContent.substring(0, newContent.indexOf(table.lines));
        const afterTable = newContent.substring(newContent.indexOf(table.lines) + table.lines.length);

        // Замінюємо на HTML img тег з маркером для мобільного додатку
        newContent = beforeTable + `\n\n![table](${imageUrl})\n\n` + afterTable;
        tableIndex++;
      }
    }

    if (newContent !== section.content) {
      updates.push({
        id: section.id,
        content: newContent
      });
    }
  }

  await browser.close();

  console.log(`\n=== Оновлення бази даних ===`);
  console.log(`Sections to update: ${updates.length}`);

  // Записати SQL для оновлення
  const sqlPath = path.join(__dirname, 'update-table-images.sql');
  let sql = '-- Оновлення контенту з зображеннями таблиць\n-- Згенеровано: ' + new Date().toISOString() + '\n\n';

  for (const update of updates) {
    const escapedContent = update.content.replace(/'/g, "''");
    sql += `UPDATE guide_sections SET content = '${escapedContent.substring(0, 100)}...' WHERE id = ${update.id};\n`;
    sql += `-- Full content in separate file due to length\n\n`;
  }

  // Зберегти повний контент у JSON файл
  const jsonPath = path.join(__dirname, 'table-content-updates.json');
  fs.writeFileSync(jsonPath, JSON.stringify(updates, null, 2));
  console.log(`Saved ${updates.length} updates to ${jsonPath}`);

  // Оновити базу даних
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('guide_sections')
      .update({ content: update.content })
      .eq('id', update.id);

    if (updateError) {
      console.error(`Error updating section ${update.id}:`, updateError);
    } else {
      console.log(`Updated section ${update.id}`);
    }
  }

  console.log('\n=== Готово! ===');
}

main().catch(console.error);
