const fs = require('fs');
const data = JSON.parse(fs.readFileSync('table-content-base64.json', 'utf8'));

// Create migration with all updates using dollar quoting
let sql = '-- Оновлення всіх секцій з base64 зображеннями таблиць\n-- Згенеровано: ' + new Date().toISOString() + '\n\n';

for (const section of data) {
  if (section.id === 824) continue; // Already updated
  sql += `-- Section ${section.id}\n`;
  sql += `UPDATE guide_sections SET content = $$base64$$${section.content}$$base64$$ WHERE id = ${section.id};\n\n`;
}

fs.writeFileSync('update_all_base64.sql', sql);
console.log('Generated migration for', data.length - 1, 'sections');
console.log('File size:', Math.round(fs.statSync('update_all_base64.sql').size / 1024), 'KB');
