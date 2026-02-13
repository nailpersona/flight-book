#!/usr/bin/env python3
"""
Simple SQL parser and builder for PVP sections.
"""
import re

# Read the SQL file
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

sections = []
for line in lines:
    line = line.strip()
    if not line or not line.startswith('INSERT INTO guide_sections'):
        continue

    # Simple regex extraction
    # Find document_id (always 1), parent_id (number or NULL), title, order_num
    # Pattern: VALUES (1, parent_id, 'title', ..., order_num);

    # Find parent_id
    pid_match = re.search(r'VALUES\s*\(\s*1,\s*(\d+|NULL)', line)
    if not pid_match:
        continue
    parent_id = pid_match.group(1)

    # Find title (first quoted string after parent_id)
    title_match = re.search(r'VALUES\s*\(\s*1,\s*' + re.escape(parent_id) + r",\s*'([^']+)'", line)
    if not title_match:
        continue
    title = title_match.group(1)

    # Find order_num (last number)
    order_match = re.search(r',\s*(\d+)\s*\)\s*;$', line)
    if not order_match:
        continue
    order_num = order_match.group(1)

    # Keep original line but note the parent_id
    sections.append({
        'parent_id': parent_id,
        'title': title,
        'order_num': order_num,
        'original_line': line
    })

print(f"Parsed {len(sections)} sections")

# Separate main and child
main_sections = [s for s in sections if s['parent_id'] == 'NULL']
child_sections = [s for s in sections if s['parent_id'] != 'NULL']

print(f"Main sections: {len(main_sections)}")
print(f"Child sections: {len(child_sections)}")

# Build output
output = []
output.append("-- PVP Document Sections - Flat Import")
output.append("-- All sections imported with parent_id = NULL")
output.append("-- Document ID: 1 (ПВП ДАУ)")
output.append("")
output.append("BEGIN;")
output.append("")
output.append("-- Clear existing data for document 1")
output.append("DELETE FROM guide_sections WHERE document_id = 1;")
output.append("")
output.append("-- Import all sections")
output.append("")

for s in sections:
    # Change parent_id to NULL in the original line
    # Replace: VALUES (1, <parent_id>, with VALUES (1, NULL,
    new_line = re.sub(
        r'(VALUES\s*\(\s*1,\s*)\d+,',
        r'\1NULL,',
        s['original_line']
    )
    output.append(new_line)

output.append("")
output.append("COMMIT;")

# Write to file
output_path = r'C:\Users\fujitsu\Desktop\fly-book\pvp_import_flat.sql'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print(f"\nOutput written to: {output_path}")
print(f"Total lines: {len(output)}")

# Also create a file showing the parent-child structure for manual review
structure_lines = []
structure_lines.append("-- PVP Document Structure Analysis")
structure_lines.append("-- Shows which parent_id values are referenced and need manual linking")
structure_lines.append("")

# Group children by parent_id
parent_groups = {}
for s in child_sections:
    pid = s['parent_id']
    if pid not in parent_groups:
        parent_groups[pid] = []
    parent_groups[pid].append(s)

structure_lines.append(f"== Parent IDs referenced in file ==", str(len(parent_groups)))
for pid in sorted(parent_groups.keys(), key=lambda x: int(x) if x.isdigit() else 0):
    children = parent_groups[pid]
    structure_lines.append(f"")
    structure_lines.append(f"Parent ID {pid} ({len(children)} children):")
    for child in children[:5]:
        structure_lines.append(f"  - {child['title'][:80]}")
    if len(children) > 5:
        structure_lines.append(f"  ... and {len(children) - 5} more")

# Write structure analysis
structure_path = r'C:\Users\fujitsu\Desktop\fly-book\pvp_structure_analysis.txt'
with open(structure_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(structure_lines))

print(f"Structure analysis written to: {structure_path}")
