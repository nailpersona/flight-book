import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
        }
    });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
const sqlOrderNums = new Set(doc1Sections.map(s => s.order_num));
console.log(`Total sections in SQL for doc 1: ${doc1Sections.length}`);

// Get existing order_nums from database
const { data: existingData, error } = await supabase
    .from('guide_sections')
    .select('order_num')
    .eq('document_id', 1);

if (error) {
    console.error('Error fetching existing sections:', error);
    process.exit(1);
}

const existingOrderNums = new Set(existingData.map(s => s.order_num));
console.log(`Total sections in database: ${existingOrderNums.size}`);

// Find missing order_nums
const missingOrderNums = [...sqlOrderNums].filter(n => !existingOrderNums.has(n)).sort((a, b) => a - b);

console.log(`\nMissing order_nums: ${missingOrderNums.length}`);
console.log(`Missing: [${missingOrderNums.join(', ')}]`);

// Get the missing sections details
const missingSections = doc1Sections.filter(s => missingOrderNums.includes(s.order_num));
console.log(`\nMissing sections details:`);
for (const section of missingSections) {
    console.log(`  order_num ${section.order_num}: "${section.title.substring(0, 80)}..."`);
    console.log(`    parent_id: ${section.parent_id}`);
}
