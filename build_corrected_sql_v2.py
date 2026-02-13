#!/usr/bin/env python3
import re

# Read the SQL file with proper encoding
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse all sections
all_sections = []
for line_num, line in enumerate(lines, 1):
    line = line.strip()
    if not line or not line.startswith('INSERT INTO guide_sections'):
        continue

    # Extract the VALUES part using regex
    values_match = re.search(r'VALUES\s*\((.+)\);\s*$', line, re.DOTALL)
    if not values_match:
        print(f"Line {line_num}: No VALUES match")
        continue

    values_str = values_match.group(1)

    # Manual parsing to handle $$...$$ and '...' properly
    # The format is: document_id, parent_id, title, content, order_num
    # We need to find each part in order

    parts = []
    pos = 0

    for part_idx in range(5):  # We need 5 parts
        if pos >= len(values_str):
            break

        # Skip whitespace and comma
        while pos < len(values_str) and values_str[pos] in ' \t\n,':
            pos += 1

        if pos >= len(values_str):
            break

        start = pos

        if part_idx in [1]:  # parent_id can be NULL or a number
            # Check for NULL
            if values_str[pos:pos+4].upper() == 'NULL':
                parts.append('NULL')
                pos += 4
                continue

        # For other parts, check the delimiter type
        if values_str[pos] == "'":
            # Single-quoted string
            pos += 1
            start = pos
            while pos < len(values_str):
                if values_str[pos] == "'" and (pos == 0 or values_str[pos-1] != '\\'):
                    break
                pos += 1
            parts.append(values_str[start:pos])
            pos += 1  # Skip closing quote
        elif values_str[pos:pos+2] == '$$':
            # Dollar-quoted string
            pos += 2
            start = pos
            while pos < len(values_str) - 1:
                if values_str[pos:pos+2] == '$$':
                    break
                pos += 1
            parts.append(values_str[start:pos])
            pos += 2  # Skip closing $$
        else:
            # Unquoted value (number)
            while pos < len(values_str) and values_str[pos] not in ',)':
                pos += 1
            parts.append(values_str[start:pos])

    if len(parts) != 5:
        print(f"Line {line_num}: Got {len(parts)} parts, expected 5")
        print(f"  Parts: {parts[:3]}")
        # Try to continue anyway
        if len(parts) < 5:
            continue

    document_id = parts[0].strip()
    parent_id = parts[1].strip()
    title = parts[2].strip()
    content = parts[3].strip()
    order_num = parts[4].strip()

    all_sections.append({
        'document_id': document_id,
        'parent_id': parent_id,
        'title': title,
        'content': content,
        'order_num': order_num,
        'raw_line': line
    })

# Separate main and child sections
main_sections = [s for s in all_sections if s['parent_id'] == 'NULL']
child_sections = [s for s in all_sections if s['parent_id'] != 'NULL']

print(f"Total sections parsed: {len(all_sections)}")
print(f"Main sections: {len(main_sections)}")
print(f"Child sections: {len(child_sections)}")

# Build order_num to title mapping for main sections
order_to_title = {}
for s in main_sections:
    order_to_title[s['order_num']] = s['title']

# Get unique parent_id values from child sections
parent_order_nums = set()
for s in child_sections:
    if s['parent_id'].isdigit():
        parent_order_nums.add(int(s['parent_id']))

print(f"\n=== PARENT ORDER_NUMS REFERENCED BY CHILDREN ===")
for order_num in sorted(parent_order_nums):
    count = sum(1 for s in child_sections if s['parent_id'] == str(order_num))
    # Find parent title
    parent_title = order_to_title.get(str(order_num), "NOT FOUND")
    print(f"order_num: {order_num} ({count} children) -> parent: {parent_title[:50]}...")

# Now build the corrected SQL
output_lines = []
output_lines.append("-- PVP Document Sections - Corrected SQL")
output_lines.append("-- Parent references use subqueries by title")
output_lines.append("-- Document ID: 1 (ПВП ДАУ)")
output_lines.append("")
output_lines.append("BEGIN;")

# First, insert all main sections with parent_id = NULL
output_lines.append("")
output_lines.append("-- === MAIN SECTIONS (parent_id IS NULL) ===")
for s in main_sections:
    output_lines.append(s['raw_line'])

# Then insert child sections using subqueries for parent_id
output_lines.append("")
output_lines.append("-- === CHILD SECTIONS (using subqueries for parent_id) ===")

missing_parents = 0
for s in child_sections:
    parent_order = s['parent_id']
    parent_title = order_to_title.get(parent_order)

    if not parent_title:
        print(f"Warning: Could not find parent title for order_num={parent_order}")
        print(f"  Child title: {s['title'][:100]}")
        missing_parents += 1
        # Use the original line with NULL parent as fallback
        # output_lines.append(f"-- MISSING PARENT for order_num={parent_order}: {s['raw_line']}")
        continue

    # Build new INSERT with subquery for parent_id
    # Escape single quotes in title for SQL
    escaped_title = s['title'].replace("'", "''")
    escaped_parent_title = parent_title.replace("'", "''")

    new_line = f"INSERT INTO guide_sections (document_id, parent_id, title, content, order_num) VALUES "
    new_line += f"(1, (SELECT id FROM guide_sections WHERE title = '{escaped_parent_title}' AND document_id = 1 AND parent_id IS NULL LIMIT 1), "
    new_line += f"'{escaped_title}', {s['content']}, {s['order_num']});"

    output_lines.append(new_line)

output_lines.append("")
output_lines.append("COMMIT;")

# Write to file
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_insert_corrected.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print(f"\n=== SUMMARY ===")
print(f"Corrected SQL file written to: C:\\Users\\fujitsu\\Desktop\\fly-book\\pvp_insert_corrected.sql")
print(f"Total lines: {len(output_lines)}")
print(f"Total INSERT statements: {len(main_sections) + len(child_sections) - missing_parents}")
print(f"Main sections: {len(main_sections)}")
print(f"Child sections inserted: {len(child_sections) - missing_parents}")
print(f"Child sections skipped (missing parent): {missing_parents}")
