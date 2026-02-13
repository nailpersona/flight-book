import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the original SQL file
const sqlFile = path.join(__dirname, 'pvp_sections_clean.sql');
const content = fs.readFileSync(sqlFile, 'utf-8');

// Parse INSERT statements
const inserts = [];
const lines = content.split('\n');
let currentStmt = '';

for (const line of lines) {
    const stripped = line.trim();
    if (stripped.startsWith('INSERT INTO guide_sections')) {
        if (currentStmt) {
            inserts.push(currentStmt);
        }
        currentStmt = stripped;
    } else if (currentStmt) {
        currentStmt += '\n' + line;
        if (stripped.endsWith(';')) {
            currentStmt = currentStmt.trim().replace(/;$/, '');
            inserts.push(currentStmt);
            currentStmt = '';
        }
    }
}

// Parse all sections for document 1
function parseInsert(insertStmt) {
    const match = insertStmt.match(
        /VALUES \((\d+), ([\d]+|NULL), '([^']*)'(?:, \$\$(.*?)\$\$|, NULL), (\d+)\)/s
    );
    if (match) {
        return {
            document_id: parseInt(match[1]),
            parent_id: match[2] === 'NULL' ? null : parseInt(match[2]),
            title: match[3].replace(/''/g, "'"),
            content: match[4] === 'NULL' ? null : match[4],
            order_num: parseInt(match[5])
        };
    }
    return null;
}

const doc1Sections = inserts.map(parseInsert).filter(s => s && s.document_id === 1);

console.log(`Total sections for document 1 in SQL: ${doc1Sections.length}`);
console.log(`Unique order_nums in SQL: ${new Set(doc1Sections.map(s => s.order_num)).size}`);

// Find duplicates by title and content
const contentMap = new Map();
for (const section of doc1Sections) {
    const key = `${section.order_num}|${section.title.substring(0, 50)}`;
    if (contentMap.has(key)) {
        contentMap.get(key).push(section);
    } else {
        contentMap.set(key, [section]);
    }
}

// Show duplicates
const duplicates = [];
for (const [key, sections] of contentMap) {
    if (sections.length > 1) {
        duplicates.push({ key, sections });
    }
}

console.log(`\nDuplicate entries by order_num+title: ${duplicates.length}`);
if (duplicates.length > 0) {
    console.log('\nFirst 5 duplicates:');
    for (const dup of duplicates.slice(0, 5)) {
        console.log(`  order_num ${dup.sections[0].order_num}: "${dup.sections[0].title.substring(0, 60)}..." - ${dup.sections.length} entries`);
    }
}
