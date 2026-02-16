const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('table-content-base64.json', 'utf8'));

// Sections already updated
const done = [824, 833];

// Create individual files for each section
for (const section of data) {
  if (done.includes(section.id)) continue;

  const sql = `UPDATE guide_sections SET content = $$${section.content}$$ WHERE id = ${section.id};`;
  fs.writeFileSync(`update_${section.id}.sql`, sql);
  console.log(`Created update_${section.id}.sql`);
}
