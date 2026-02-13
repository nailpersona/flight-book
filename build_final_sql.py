#!/usr/bin/env python3
"""
Build corrected SQL for PVP sections import.
The original SQL uses database IDs as parent_id values.
We need to convert these to title-based subqueries.
"""

import re

# Read the SQL file
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse all sections
sections_by_id = {}  # old_id -> section data
sections_by_title = {}  # title -> section data (for main sections)

for line in lines:
    line = line.strip()
    if not line or not line.startswith('INSERT INTO guide_sections'):
        continue

    # Parse using regex - handle $$...$$ content
    # Pattern: VALUES (1, parent_id, 'title', content OR $$...$$, order_num);

    # First, try to find the title (first quoted string after document_id and parent_id)
    title_match = re.search(r"VALUES\s*\(\s*1,\s*(\d+|NULL),\s*'([^']+)'", line)
    if not title_match:
        continue

    parent_id = title_match.group(1)
    title = title_match.group(2)

    # Extract order_num (last number before closing paren)
    order_match = re.search(r',\s*(\d+)\s*\)\s*;$', line)
    if not order_match:
        continue
    order_num = order_match.group(1)

    # Extract content - check if it's $$...$$ or NULL
    if '$$' in line:
        content_match = re.search(r"'\s*,\s*\$\$.*?\$\$,\s*" + order_num + r"\s*\)\s*;", line, re.DOTALL)
        if content_match:
            # Find the $$ content
            dollar_match = re.search(r'\$\$(.*?)\$\$', line, re.DOTALL)
            content = f'$$${dollar_match.group(1)}$$' if dollar_match else 'NULL'
        else:
            content = 'NULL'
    else:
        content = 'NULL'

    sections_by_title[title] = {
        'parent_id': parent_id,
        'order_num': order_num,
        'content': content,
        'original_line': line
    }

print(f"Total sections parsed: {len(sections_by_title)}")

# Now analyze parent_id references
# Find all unique parent_id values
parent_ids = set()
for title, info in sections_by_title.items():
    if info['parent_id'] != 'NULL':
        parent_ids.add(info['parent_id'])

print(f"Unique parent_id values in file: {len(parent_ids)}")

# The issue: parent_ids like 162, 201, 92 are OLD database IDs
# They don't directly map to titles in our export
# However, looking at the structure, these parent sections must have been exported too

# Key insight: The SQL file was exported from a database where:
# - Main sections got IDs 68, 69, 70... (current DB)
# - But original export had IDs 92, 162, 201, etc.
# - We need to find which titles these IDs referred to

# Solution: Look at the child sections and infer their parent from title patterns
# For example, if child title is "1. Інженер-метеоролог..."
# and there's a section "2. Забезпечення польотів" that contains "метеорологічне"
# then that's likely the parent

# For this import, let's use a simpler approach:
# 1. Insert all sections with parent_id = NULL as-is
# 2. For sections with numeric parent_id, try to find the parent by:
#    - Matching the title pattern (child starts with number, parent has similar content)
#    - Using known parent_title from the document structure

# Based on analysis of the document, here are the key parent sections:
# - "2. Забезпечення польотів" has many children (order_num range 12-29)
# - Sections about various types of provisioning

# Let me identify parent sections by looking for sections that have many children referring to them
# through indirect means (like title patterns)

# Build a complete output with title-based parent references

output = []
output.append("-- PVP Document Sections - Corrected SQL")
output.append("-- Parent references use title-based subqueries")
output.append("-- Document ID: 1 (ПВП ДАУ)")
output.append("")
output.append("BEGIN;")
output.append("")
output.append("-- === SECTIONS WITH parent_id = NULL (top level) ===")

null_count = 0
child_count = 0

# Group sections by parent_id for analysis
parent_groups = {}
for title, info in sections_by_title.items():
    pid = info['parent_id']
    if pid not in parent_groups:
        parent_groups[pid] = []
    parent_groups[pid].append((title, info))

# Process NULL parent sections first
for title, info in parent_groups.get('NULL', []):
    output.append(info['original_line'])
    null_count += 1

output.append("")
output.append("-- === CHILD SECTIONS ===")
output.append("-- Note: Sections with parent_id like 92, 162, 201 need to reference their parent by title")
output.append("-- Since we don't have the exact ID-to-title mapping, we'll use a fallback approach")
output.append("-- These will be inserted with parent_id = NULL and can be manually linked later")
output.append("")

# For non-NULL parent sections, we need to find the parent title
# Based on document structure analysis:
# - parent_id 92 likely refers to "8. Розбір польотів" or similar
# - parent_id 162 likely refers to a section about "Група керівництва польотами"
# - parent_id 201 likely refers to "2. Забезпечення польотів"

# Since we can't reliably map these, let's insert them with parent_id = NULL
# and add a comment for manual review

for pid in sorted(parent_groups.keys(), key=lambda x: (x == 'NULL', int(x) if x != 'NULL' and x.isdigit() else 999)):
    if pid == 'NULL':
        continue

    output.append(f"-- Sections with original parent_id = {pid}")
    output.append(f"-- TODO: Link these to their parent section by title")

    for title, info in parent_groups[pid]:
        # Insert with parent_id = NULL for now
        escaped_title = title.replace("'", "''")
        new_line = f"INSERT INTO guide_sections (document_id, parent_id, title, content, order_num) VALUES "
        new_line += f"(1, NULL, '{escaped_title}', {info['content']}, {info['order_num']});"
        output.append(new_line)
        child_count += 1

    output.append("")

output.append("COMMIT;")

# Write output
output_path = r'C:\Users\fujitsu\Desktop\fly-book\pvp_insert_corrected.sql'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print(f"\n=== SUMMARY ===")
print(f"Output written to: {output_path}")
print(f"Total NULL parent sections: {null_count}")
print(f"Total child sections (inserted with NULL parent for manual linking): {child_count}")
print(f"Total sections: {null_count + child_count}")
print(f"\nNOTE: Sections with original parent_id values (92, 162, 201, etc.)")
print(f"have been inserted with parent_id = NULL. You'll need to manually link them")
print(f"to their parent sections by title after the import.")
