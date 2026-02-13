const fs = require('fs');
const path = require('path');

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

// Failed order_nums from import
const failedOrderNums = [41, 66, 85, 86, 335, 341, 342, 343, 355, 357, 361, 362, 364, 367, 370, 371, 373, 374, 375, 376, 377, 378];

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

// Find failed sections and their parent_ids
const failedSections = [];
for (const insert of inserts) {
    const data = parseInsert(insert);
    if (data && failedOrderNums.includes(data.order_num)) {
        failedSections.push(data);
    }
}

console.log('Failed sections:');
console.log('order_num | parent_id | title');
console.log('----------|-----------|' + '-'.repeat(50));

// Get unique parent_ids
const parentIdsNeeded = new Set();
for (const section of failedSections) {
    console.log(`${String(section.order_num).padStart(9)} | ${String(section.parent_id ?? 'NULL').padStart(9)} | ${section.title.substring(0, 50)}`);
    if (section.parent_id) {
        parentIdsNeeded.add(section.parent_id);
    }
}

console.log(`\nParent IDs needed: [${[...parentIdsNeeded].sort((a,b) => a-b).join(', ')}]`);
