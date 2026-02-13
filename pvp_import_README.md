# PVP DAU Document Import - Summary

## Files Generated

### 1. `pvp_import_all_sections.sql` (MAIN FILE)
**Use this file to import all 510 sections from the ПВП ДАУ document.**

This SQL file:
- Deletes existing sections for document_id = 1
- Imports all 510 sections with `parent_id = NULL`
- Preserves all content (including $$...$$ delimited text)
- Maintains correct order_num values

**Usage:**
```sql
-- Run in Supabase SQL Editor
\i C:\Users\fujitsu\Desktop\fly-book\pvp_import_all_sections.sql
```

### 2. `pvp_link_parents.sql` (TEMPLATE)
Parent linking template - currently contains placeholder examples.

Due to the original export using database IDs (92, 162, 201, etc.) as parent_id values
which don't exist in the current database, all sections are imported as top-level sections.

## Why parent_id = NULL for all sections?

The original SQL file (`pvp_sections_clean.sql`) was exported from a database where:
- Main sections had IDs like 68, 69, 70... (not in this export)
- Intermediate sections had IDs like 92, 162, 201...
- Child sections referenced these intermediate section IDs as parent_id

In our current database, those intermediate section IDs don't exist yet (they're being created now).
Therefore, we cannot reference them during import.

## Next Steps (After Import)

### Option 1: Manual Linking via Supabase Dashboard
1. Import all sections using `pvp_import_all_sections.sql`
2. In Supabase Dashboard, manually link parents to children by:
   - Finding child sections (those starting with numbers like "1.", "2.", etc.)
   - Finding their parent sections by content/title matching
   - Updating the parent_id field

### Option 2: Create Automated Linking Script
To automate parent linking, we would need to:
1. First import all sections (parent_id = NULL)
2. Query back to get the new IDs
3. Create UPDATE statements based on title patterns

Example automated linking queries (run after import):
```sql
-- Link children to "2. Забезпечення польотів"
UPDATE guide_sections
SET parent_id = (
  SELECT id FROM guide_sections
  WHERE title LIKE '%Забезпечення польотів%'
  AND document_id = 1
  AND parent_id IS NULL
  LIMIT 1
)
WHERE document_id = 1
AND title LIKE '1. %'
AND (
  title LIKE '%Інженер-метеоролог%' OR
  title LIKE '%Відповідальний з РЛЗ%' OR
  title LIKE '%КрБЗ%' OR
  title LIKE '%КрДЗ%' OR
  title LIKE '%КрЗП%'
);
```

## Section Statistics
- Total sections: 510
- Main sections (originally parent_id = NULL): 143
- Child sections (originally had numeric parent_id): 367
- Unique parent_id values in original file: 27

## Known Parent Sections (for manual linking)
Based on analysis of the document structure:

| Original parent_id | Likely Parent Section Title | Children Count |
|-------------------|----------------------------|----------------|
| 92 | "8. Розбір польотів" or similar | ~40 |
| 162 | Related to "3. Група керівництва польотами" | ~32 |
| 201 | "2. Забезпечення польотів" (Flight Support) | ~178 |
| 1 | "V. Розвідка погоди" | 5 |
| 6 | "XII. Особливості організації керівництва польотами" | 2 |
| 9 | "ІV. Організація польотів" | 7 |

## File Locations
All files are in: `C:\Users\fujitsu\Desktop\fly-book\`

- `pvp_import_all_sections.sql` - Main import file (526 lines)
- `pvp_sections_clean.sql` - Original source file (516 lines)
- `pvp_link_parents.sql` - Parent linking template
- `pvp_import_README.md` - This documentation
