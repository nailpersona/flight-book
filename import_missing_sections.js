const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    process.exit(1);
}

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

// Helper function to parse INSERT statement
function parseInsert(insertStmt) {
    // Match: VALUES (document_id, parent_id, 'title', $$content$$ or NULL, order_num)
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

// Process in batches
async function importBatch(batch) {
    const results = [];
    for (const insert of batch) {
        const data = parseInsert(insert);
        if (data) {
            try {
                const { error } = await supabase
                    .from('guide_sections')
                    .insert(data);
                if (error) {
                    console.error(`  Error inserting order_num ${data.order_num}:`, error.message);
                    results.push({ order_num: data.order_num, success: false, error: error.message });
                } else {
                    results.push({ order_num: data.order_num, success: true });
                }
            } catch (e) {
                console.error(`  Exception for order_num ${data.order_num}:`, e.message);
                results.push({ order_num: data.order_num, success: false, error: e.message });
            }
        }
    }
    return results;
}

async function main() {
    const batchSize = 20;
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < inserts.length; i += batchSize) {
        const batch = inserts.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(inserts.length / batchSize);

        console.log(`\nProcessing batch ${batchNum}/${totalBatches}...`);

        const results = await importBatch(batch);

        for (const result of results) {
            if (result.success) {
                imported++;
                console.log(`  ✓ Inserted order_num ${result.order_num}`);
            } else {
                failed++;
            }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total to import: ${inserts.length}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Failed: ${failed}`);
}

main().catch(console.error);
