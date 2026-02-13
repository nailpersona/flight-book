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

// Find section with order_num 49
const section49 = inserts.map(parseInsert).find(s => s && s.document_id === 1 && s.order_num === 49);

if (!section49) {
    console.log('Section with order_num 49 not found in SQL file');
    process.exit(1);
}

console.log('Found section 49:');
console.log(`  title: ${section49.title.substring(0, 80)}...`);
console.log(`  parent_id: ${section49.parent_id}`);
console.log(`  content length: ${section49.content?.length || 0}`);

// Get parent_id mapping
const { data: allSections } = await supabase
    .from('guide_sections')
    .select('id, order_num')
    .eq('document_id', 1);

const orderToId = {};
for (const section of allSections) {
    orderToId[section.order_num] = section.id;
}

const newParentId = section49.parent_id !== null
    ? (orderToId[section49.parent_id] || null)
    : null;

console.log(`Mapped parent_id: ${section49.parent_id} -> ${newParentId}`);

// Import section
const insertData = {
    document_id: section49.document_id,
    parent_id: newParentId,
    title: section49.title,
    content: section49.content,
    order_num: section49.order_num
};

const { error } = await supabase
    .from('guide_sections')
    .insert(insertData);

if (error) {
    console.error('Error inserting order_num 49:', error.message);
    process.exit(1);
}

console.log('✓ Successfully inserted order_num 49');
