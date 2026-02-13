const fs = require('fs');
const path = require('path');

// Read the SQL file
const sqlFile = path.join(__dirname, 'pvp_sections_clean.sql');
const content = fs.readFileSync(sqlFile, 'utf-8');

// Extract all INSERT statements
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

console.log(`Total INSERT statements: ${inserts.length}`);

// Parse order_num from each INSERT
const allSections = [];
for (const insert of inserts) {
    // Match: VALUES (document_id, parent_id, 'title', $$content$$ or NULL, order_num)
    const match = insert.match(/VALUES \((\d+), ([\d]+|NULL), '([^']*)'(?:, \$\$(.*?)\$\$|, NULL), (\d+)\)/s);
    if (match) {
        const docId = parseInt(match[1]);
        const parentId = match[2] === 'NULL' ? null : parseInt(match[2]);
        const title = match[3].replace(/''/g, "'");
        const content = match[4] === 'NULL' ? null : match[4];
        const orderNum = parseInt(match[5]);

        if (docId === 1) {
            allSections.push({ orderNum, insert });
        }
    }
}

console.log(`Document 1 sections: ${allSections.length}`);
console.log(`Order num range: ${allSections[0]?.orderNum} - ${allSections[allSections.length - 1]?.orderNum}`);

// Existing order_nums from database query result
const existingNums = new Set([
    1,2,3,4,5,6,7,8,9,10,11,12,13,14,45,46,50,51,57,58,59,60,62,63,65,67,68,69,70,71,72,73,74,76,77,
    81,82,83,84,87,89,90,91,92,93,94,95,96,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,
    141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,
    166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,
    191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,
    216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,
    241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,
    266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,
    291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,
    317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,385,399,401,402,403,404,405,408,
    409,410,411,412,413,414,415,416,417,418,419,420,421,422,423,424,425,426,427,428,429,430,431,432,433
]);

// Find missing sections
const missingSections = allSections.filter(s => !existingNums.has(s.orderNum));

console.log(`\nMissing sections: ${missingSections.length}`);
console.log(`Missing order_nums: [${missingSections.slice(0, 30).map(s => s.orderNum).join(', ')}...]`);

// Write missing sections to a new SQL file
const missingSql = missingSections.map(s => s.insert + ';').join('\n');
const outputFile = path.join(__dirname, 'pvp_sections_missing.sql');
fs.writeFileSync(outputFile, missingSql, 'utf-8');
console.log(`\nWrote missing sections to: ${outputFile}`);
