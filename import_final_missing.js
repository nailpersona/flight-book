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

// Missing order_nums
const missingOrderNums = [17, 18, 21, 22, 24, 34, 35, 36, 37, 40, 41, 61, 64, 79, 85, 98, 110, 335, 336, 342, 345, 346, 348, 353, 354, 363, 364, 365, 368, 370, 371, 374, 375, 376, 378];

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

// Get all existing sections to build parent_id mapping
const { data: allSections } = await supabase
    .from('guide_sections')
    .select('id, order_num')
    .eq('document_id', 1);

// Create mapping: order_num -> id (for parent lookup)
const orderToId = {};
for (const section of allSections) {
    orderToId[section.order_num] = section.id;
}
console.log(`Loaded ${Object.keys(orderToId).length} existing sections`);

// Find missing sections from SQL
const missingSections = inserts.map(parseInsert).filter(s =>
    s && s.document_id === 1 && missingOrderNums.includes(s.order_num)
);

console.log(`Found ${missingSections.length} missing sections to import`);

// Import missing sections
async function importSections() {
    let imported = 0;
    let failed = 0;

    for (const section of missingSections) {
        try {
            // Map parent_id from order_num to actual id
            const newParentId = section.parent_id !== null
                ? (orderToId[section.parent_id] || null)
                : null;

            const insertData = {
                document_id: section.document_id,
                parent_id: newParentId,
                title: section.title,
                content: section.content,
                order_num: section.order_num
            };

            const { error } = await supabase
                .from('guide_sections')
                .insert(insertData);

            if (error) {
                console.error(`  ✗ Error inserting order_num ${section.order_num} (parent ${section.parent_id} -> ${newParentId}):`, error.message);
                failed++;
            } else {
                imported++;
                console.log(`  ✓ Inserted order_num ${section.order_num} (parent: ${section.parent_id} -> ${newParentId})`);
                // Update mapping for potential children
                const { data: newData } = await supabase
                    .from('guide_sections')
                    .select('id')
                    .eq('order_num', section.order_num)
                    .single();
                if (newData) {
                    orderToId[section.order_num] = newData.id;
                }
            }
        } catch (e) {
            console.error(`  ✗ Exception for order_num ${section.order_num}:`, e.message);
            failed++;
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total to import: ${missingSections.length}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Failed: ${failed}`);
}

importSections().catch(console.error);
