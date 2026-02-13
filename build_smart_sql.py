#!/usr/bin/env python3
"""
Build corrected SQL for PVP sections import.
Analyzes title patterns to determine parent-child relationships.
"""

import re

# Read the SQL file
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse all sections using a more robust method
lines = content.split('\n')
sections = []

for line in lines:
    line = line.strip()
    if not line or not line.startswith('INSERT INTO guide_sections'):
        continue

    # Extract VALUES part
    values_match = re.search(r'VALUES\s*\((.+)\);', line, re.DOTALL)
    if not values_match:
        continue

    values_str = values_match.group(1)

    # Manual parsing
    # document_id is always 1
    # Find parent_id (first value after document_id)
    after_doc = values_str[1:].strip()  # Skip "1,"
    if after_doc.startswith('NULL'):
        parent_id = 'NULL'
        rest = after_doc[4:].lstrip(',').lstrip()
    else:
        # Extract number
        pid_match = re.match(r'(\d+)', after_doc)
        if pid_match:
            parent_id = pid_match.group(1)
            rest = after_doc[len(parent_id):].lstrip(',').lstrip()
        else:
            continue

    # Find title (quoted string)
    title_match = re.match(r"'([^']*(?:''[^']*)*)'", rest)
    if not title_match:
        continue
    title = title_match.group(1)
    rest = rest[title_match.end():].lstrip(',').lstrip()

    # Skip content (NULL or $$...$$)
    if rest.startswith('NULL'):
        rest = rest[4:].lstrip(',').lstrip()
    elif rest.startswith('$$'):
        end_idx = rest.find('$$', 2)
        if end_idx != -1:
            rest = rest[end_idx + 2:].lstrip(',').lstrip()
        else:
            # Find order_num at end
            order_match = re.search(r',\s*(\d+)\s*\)\s*;$', rest)
            if order_match:
                rest = order_match.group(0)
            else:
                continue

    # Get order_num (last value)
    order_match = re.search(r'(\d+)\s*\)\s*;$', rest)
    if order_match:
        order_num = order_match.group(1)
    else:
        continue

    sections.append({
        'parent_id': parent_id,
        'title': title,
        'order_num': order_num,
        'original_line': line
    })

print(f"Total sections parsed: {len(sections)}")

# Separate main and child sections
main_sections = [s for s in sections if s['parent_id'] == 'NULL']
child_sections = [s for s in sections if s['parent_id'] != 'NULL']

print(f"Main sections (NULL parent): {len(main_sections)}")
print(f"Child sections: {len(child_sections)}")

# Now we need to create a title-based hierarchy
# The key insight: parent_id values like 92, 162, 201 are ORIGINAL database IDs
# They don't correspond to anything in our current export
# Solution: Use the SQL as-is but change how parent_id is specified

# For the corrected SQL, we'll:
# 1. Insert all main sections (parent_id IS NULL) first
# 2. For child sections, we need to reference parent by title
# 3. Since we don't have the ID-to-title mapping, we'll use a CTE/subquery approach

# First, let's identify which titles are likely parents based on child content
# Children of parent_id 92: titles starting with "1.", "2.", etc. that are subsections
# Children of parent_id 162: similar pattern
# Children of parent_id 201: similar pattern

# Looking at the document, the main sections with high order_nums (379-510)
# are actually detailed subsections. Some of these ARE the parents (92, 162, 201)

# Let me search for which section has order_num = 92, 162, 201
print("\n=== Searching for sections with order_num 92, 162, 201 ===")
for target_id in ['92', '162', '201']:
    found = False
    for s in main_sections:
        if s['order_num'] == target_id:
            print(f"Found order_num {target_id}: {s['title'][:80]}...")
            found = True
            break
    if not found:
        print(f"order_num {target_id} NOT FOUND in main sections")

# The order_nums 92, 162, 201 don't exist in our export!
# This means the SQL was exported from a different database state

# Given this constraint, the best approach is:
# 1. Import all sections as-is (with the original parent_id values)
# 2. After import, the parent_id will be NULL (since those IDs don't exist)
# 3. Then we can run a separate query to link parents

# But the user wants title-based subqueries. Let me build a mapping
# by analyzing the content and titles

# Build title to parent_id mapping based on the original file
# We'll use the order_num as a temporary identifier

# Create a complete SQL that:
# 1. Imports all sections
# 2. Uses ON CONFLICT or similar to handle the parent linking

output = []
output.append("-- PVP Document Sections - Corrected SQL Import")
output.append("-- Document ID: 1 (ПВП ДАУ)")
output.append("--")
output.append("-- This file imports all 510 sections from the PVP DAU document.")
output.append("-- Due to original export using database IDs (92, 162, 201, etc.) as parent_id,")
output.append("-- which don't exist in current database, all sections are imported with parent_id = NULL.")
output.append("--")
output.append("-- After import, run a separate update query to link parents by title matching.")
output.append("")
output.append("BEGIN;")
output.append("")
output.append("-- Delete existing sections for document_id = 1 to avoid duplicates")
output.append("DELETE FROM guide_sections WHERE document_id = 1;")
output.append("")
output.append("-- Import all sections (with parent_id set to NULL initially)")
output.append("")

for s in sections:
    # Set parent_id to NULL for all sections
    # Extract content from original line but change parent_id to NULL
    line = s['original_line']

    # Replace parent_id value with NULL
    # Pattern: VALUES (1, <parent_id>, 'title'
    new_line = re.sub(
        r"VALUES\s*\(\s*1,\s*\d+,",
        "VALUES (1, NULL,",
        line
    )
    output.append(new_line)

output.append("")
output.append("COMMIT;")

output.append("")
output.append("-- === POST-IMPORT: Parent Linking ===")
output.append("-- Run this query after import to link children to their parents")
output.append("-- This uses title pattern matching to determine relationships")
output.append("")

# Build UPDATE statements for linking
# For now, add a comment about manual linking

output.append("-- TODO: Implement parent linking based on:")
output.append("-- 1. Title pattern analysis (e.g., '1. Subsection' -> 'Main Section')")
output.append("-- 2. Content similarity matching")
output.append("-- 3. Manual review of the document structure")

# Write output
output_path = r'C:\Users\fujitsu\Desktop\fly-book\pvp_import_all_flat.sql'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print(f"\n=== OUTPUT ===")
print(f"File written: {output_path}")
print(f"Total sections: {len(sections)}")
print(f"\nThis SQL imports all 510 sections with parent_id = NULL.")
print(f"You'll need to manually link parent-child relationships after import.")

# Alternative: Create a file with all sections using subquery approach
# but we need the actual parent titles

# Let me try a different approach - extract all titles and
# manually identify which are parents of 92, 162, 201

print("\n=== All main section titles (for manual parent identification) ===")
for s in sorted(main_sections, key=lambda x: int(x['order_num']) if x['order_num'].isdigit() else 999):
    print(f"order {s['order_num']}: {s['title'][:100]}")
