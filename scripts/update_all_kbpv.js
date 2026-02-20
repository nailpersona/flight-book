/**
 * Update all КБПВ-18 placeholder sections with full content
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://klqxadvtvxvizgdjmegx.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhhZHZ0dnh2aXpnZGptZWd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYzMjc4MSwiZXhwIjoyMDg2MjA4NzgxfQ.50kZyArhfjQfy5SA8JjCfa-0H4Lv2hh7kJ_RG4j7h0g';

// All IDs that need content (excluding already done: 1146, 1151, 1152)
const IDS_TO_UPDATE = [1129, 1130, 1131, 1132, 1133, 1134, 1136, 1137, 1138, 1139, 1140, 1141, 1143, 1144, 1145, 1150, 1158];

async function updateContent(id, content) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/guide_sections?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: text.substring(0, 200) };
  }
  return { success: true };
}

function parseTupleContent(tuple) {
  let i = 0;
  const parentMatch = tuple.match(/^\(\d+,\s*\d+,\s*(\d+|NULL)/);
  if (!parentMatch) return null;

  i = parentMatch[0].length + 4;

  let title = '';
  while (i < tuple.length) {
    if (tuple[i] === "'") {
      if (tuple[i+1] === "'") {
        title += "'";
        i += 2;
      } else {
        i++;
        break;
      }
    } else {
      title += tuple[i];
      i++;
    }
  }

  i += 3;

  let content = '';
  while (i < tuple.length) {
    if (tuple[i] === "'") {
      if (tuple[i+1] === "'") {
        content += "'";
        i += 2;
      } else if (tuple[i+1] === ',' || tuple[i+1] === ')') {
        break;
      } else {
        content += tuple[i];
        i++;
      }
    } else {
      content += tuple[i];
      i++;
    }
  }

  return { title, content };
}

async function main() {
  const tuplesPath = path.join(__dirname, 'kbpv_content_tuples.json');
  const tuples = JSON.parse(fs.readFileSync(tuplesPath, 'utf-8'));

  console.log('Updating all КБПВ-18 sections with full content...\n');

  let success = 0;
  let failed = 0;

  for (const id of IDS_TO_UPDATE) {
    const tuple = tuples.find(t => t.id === id);
    if (!tuple) {
      console.log(`ID ${id}: No content tuple found`);
      failed++;
      continue;
    }

    const parsed = parseTupleContent(tuple.sql);
    if (!parsed) {
      console.log(`ID ${id}: Failed to parse content`);
      failed++;
      continue;
    }

    process.stdout.write(`ID ${id}: Updating (${Math.round(parsed.content.length/1024)}KB)... `);
    const result = await updateContent(id, parsed.content);
    if (result.success) {
      console.log('OK');
      success++;
    } else {
      console.log(`FAILED: ${result.error}`);
      failed++;
    }
  }

  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
