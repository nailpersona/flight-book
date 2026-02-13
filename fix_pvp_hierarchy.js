// Fix PVP DAU hierarchy in guide_sections table
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://klqxadvtvxvizgdjmegx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhhZHZ0dnh2aXpnZGptZWd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYzMjc4MSwiZXhwIjoyMDg2MjA4NzgxfQ.50kZyArhfjQfy5SA8JjCfa-0H4Lv2hh7kJ_RG4j7h0g';

const supabase = createClient(supabaseUrl, supabaseKey);

// Read the structure file
const structureFile = path.join(__dirname, 'pvp_structure_final.txt');
const lines = fs.readFileSync(structureFile, 'utf8').split('\n').filter(l => l.trim());

// Parse structure: title|parent_title|level
const structure = [];
for (const line of lines) {
  const parts = line.split('|');
  if (parts.length >= 2) {
    const title = parts[0].trim();
    const parentTitle = parts[1] || null;
    const level = parseInt(parts[2] || '1', 10);
    structure.push({ title, parentTitle, level });
  }
}

console.log(`Parsed ${structure.length} structure entries`);

async function fixHierarchy() {
  // Get all sections for document 1 (PVP DAU)
  const { data: sections, error } = await supabase
    .from('guide_sections')
    .select('*')
    .eq('document_id', 1);

  if (error) {
    console.error('Error fetching sections:', error);
    return;
  }

  console.log(`Found ${sections.length} sections in database`);

  // Create title -> id mapping
  const titleToId = {};
  for (const section of sections) {
    // Store by exact title match
    titleToId[section.title] = section.id;
  }

  // Create updates batch
  const updates = [];
  const errors = [];

  // Level 1: Main sections (Roman numerals) - parent_id should be null
  // Level 2: Subsections - parent_id should be the level 1 section
  // Level 3: Sub-subsections - parent_id should be the level 2 section

  for (const item of structure) {
    const sectionId = titleToId[item.title];

    if (!sectionId) {
      errors.push(`NOT FOUND: "${item.title}"`);
      continue;
    }

    let parentId = null;

    if (item.level === 2 && item.parentTitle) {
      // Find parent (level 1 section)
      parentId = titleToId[item.parentTitle];
    } else if (item.level === 3 && item.parentTitle) {
      // Find parent (level 2 subsection)
      parentId = titleToId[item.parentTitle];
    }

    if (item.level === 2 || item.level === 3) {
      if (!parentId) {
        errors.push(`PARENT NOT FOUND for "${item.title}": "${item.parentTitle}"`);
        continue;
      }
    }

    updates.push({
      id: sectionId,
      parent_id: parentId,
      level: item.level
    });
  }

  console.log(`\nPreparing ${updates.length} updates...`);
  console.log(`\nErrors: ${errors.length}`);

  if (errors.length > 0 && errors.length < 50) {
    console.log('\nFirst errors:');
    errors.slice(0, 20).forEach(e => console.log(`  - ${e}`));
  }

  // Apply updates
  let successCount = 0;
  let failCount = 0;

  for (const update of updates) {
    const { error } = await supabase
      .from('guide_sections')
      .update({ parent_id: update.parent_id })
      .eq('id', update.id);

    if (error) {
      console.error(`Error updating ${update.id}:`, error.message);
      failCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\nDone: ${successCount} updated, ${failCount} failed`);
}

fixHierarchy().then(() => process.exit(0));
