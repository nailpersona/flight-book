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

// Read the missing sections SQL file
const sqlFile = path.join(__dirname, 'pvp_sections_missing.sql');
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

console.log(`Total INSERT statements to process: ${inserts.length}`);

// Function to parse INSERT statement
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

// Parse all sections
const allSections = inserts.map(parseInsert).filter(s => s !== null);

// Failed order_nums from import - need to be imported with corrected parent_ids
const failedOrderNums = [41, 66, 85, 86, 335, 341, 342, 343, 355, 357, 361, 362, 364, 367, 370, 371, 373, 374, 375, 376, 377, 378];

// Get all existing sections from database to create mapping
async function getOrderIdMapping() {
    const { data, error } = await supabase
        .from('guide_sections')
        .select('id, order_num')
        .eq('document_id', 1);

    if (error) {
        console.error('Error fetching existing sections:', error);
        return {};
    }

    const mapping = {};
    for (const section of data) {
        mapping[section.order_num] = section.id;
    }
    return mapping;
}

let orderIdMapping = await getOrderIdMapping();
console.log(`Order_num -> ID mapping loaded: ${Object.keys(orderIdMapping).length} entries`);

// Check which parent_ids are needed
const neededParents = new Set();
for (const section of allSections) {
    if (failedOrderNums.includes(section.order_num) && section.parent_id !== null) {
        neededParents.add(section.parent_id);
    }
}
console.log(`Parent IDs needed (order_nums): [${[...neededParents].sort((a,b) => a-b).join(', ')}]`);

// Check which exist in mapping
const missingParents = [...neededParents].filter(id => !orderIdMapping[id]);
console.log(`Missing parent order_nums: [${missingParents.join(', ')}]`);

// Find and import missing parents first
const missingParentSections = allSections.filter(s => missingParents.includes(s.order_num));
console.log(`Found ${missingParentSections.length} missing parent sections to import first.`);

// Import missing parents first
let imported = 0;
for (const section of missingParentSections) {
    try {
        const newParentId = section.parent_id !== null ? (orderIdMapping[section.parent_id] || null) : null;

        const { error } = await supabase
            .from('guide_sections')
            .insert({
                document_id: section.document_id,
                parent_id: newParentId,
                title: section.title,
                content: section.content,
                order_num: section.order_num
            });

        if (error) {
            console.error(`  Error inserting parent order_num ${section.order_num}:`, error.message);
        } else {
            imported++;
            console.log(`  ✓ Inserted parent order_num ${section.order_num}`);
            const { data: newData } = await supabase
                .from('guide_sections')
                .select('id')
                .eq('order_num', section.order_num)
                .single();
            if (newData) {
                orderIdMapping[section.order_num] = newData.id;
            }
        }
    } catch (e) {
        console.error(`  Exception for parent order_num ${section.order_num}:`, e.message);
    }
}
console.log(`Imported ${imported} missing parent sections`);

// Refresh mapping after importing parents
orderIdMapping = await getOrderIdMapping();

// Now import the failed sections with corrected parent_ids
const sectionsToImport = allSections.filter(s => failedOrderNums.includes(s.order_num));
console.log(`\nImporting ${sectionsToImport.length} previously failed sections with corrected parent_ids...`);

// Process in batches with corrected parent_ids
async function importRemappedBatch(batch) {
    const results = [];
    for (const data of batch) {
        try {
            const newParentId = data.parent_id !== null ? (orderIdMapping[data.parent_id] || null) : null;

            const insertData = {
                document_id: data.document_id,
                parent_id: newParentId,
                title: data.title,
                content: data.content,
                order_num: data.order_num
            };

            const { error } = await supabase
                .from('guide_sections')
                .insert(insertData);

            if (error) {
                console.error(`  Error inserting order_num ${data.order_num} (parent ${data.parent_id} -> ${newParentId}):`, error.message);
                results.push({ order_num: data.order_num, success: false, error: error.message });
            } else {
                results.push({ order_num: data.order_num, success: true });
            }
        } catch (e) {
            console.error(`  Exception for order_num ${data.order_num}:`, e.message);
            results.push({ order_num: data.order_num, success: false, error: e.message });
        }
    }
    return results;
}

const batchSize = 10;
let totalImported = 0;
let totalFailed = 0;

for (let i = 0; i < sectionsToImport.length; i += batchSize) {
    const batch = sectionsToImport.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(sectionsToImport.length / batchSize);

    console.log(`\nProcessing batch ${batchNum}/${totalBatches}...`);

    const results = await importRemappedBatch(batch);

    for (const result of results) {
        if (result.success) {
            totalImported++;
            console.log(`  ✓ Inserted order_num ${result.order_num}`);
        } else {
            totalFailed++;
        }
    }

    await new Promise(resolve => setTimeout(resolve, 100));
}

console.log(`\n=== Summary ===`);
console.log(`Total to import: ${sectionsToImport.length}`);
console.log(`Successfully imported: ${totalImported}`);
console.log(`Failed: ${totalFailed}`);
