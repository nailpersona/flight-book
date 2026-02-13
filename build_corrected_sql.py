#!/usr/bin/env python3
import re

# Read the SQL file with proper encoding
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse all sections
all_sections = []
for line in lines:
    line = line.strip()
    if not line or not line.startswith('INSERT INTO guide_sections'):
        continue

    # Extract the VALUES part
    values_match = re.search(r'VALUES \((.+)\);$', line, re.DOTALL)
    if not values_match:
        continue

    values_str = values_match.group(1)

    # Simple parsing: split by commas but respect quoted strings
    # We'll use a simple state machine
    parts = []
    current = []
    in_quotes = False
    in_dollar = False
    depth = 0

    i = 0
    while i < len(values_str):
        c = values_str[i]

        if c == '$' and i + 1 < len(values_str) and values_str[i + 1] == '$':
            in_dollar = not in_dollar
            current.append('$$')
            i += 2
            continue

        if in_dollar:
            current.append(c)
            i += 1
            continue

        if c == "'" and (not current or values_str[i - 1] != '\\'):
            in_quotes = not in_quotes

        if c == '(' and not in_quotes:
            depth += 1
        elif c == ')' and not in_quotes:
            depth -= 1

        if c == ',' and not in_quotes and depth == 0:
            parts.append(''.join(current).strip())
            current = []
        else:
            current.append(c)

        i += 1

    if current:
        parts.append(''.join(current).strip())

    if len(parts) < 5:
        continue

    document_id = parts[0].strip()
    parent_id = parts[1].strip()
    title_raw = parts[2].strip()
    content = parts[3].strip()
    order_num = parts[4].strip()

    # Clean up title
    if title_raw.startswith("'"):
        title = title_raw[1:]
        if title.endswith("'"):
            title = title[:-1]
    elif title_raw.startswith('$$'):
        title = title_raw[2:]
        if title.endswith('$$'):
            title = title[:-2]
    else:
        title = title_raw

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

print(f"Total sections: {len(all_sections)}")
print(f"Main sections: {len(main_sections)}")
print(f"Child sections: {len(child_sections)}")

# Build title to order_num mapping for main sections (these will be parent references)
title_to_order = {}
for s in main_sections:
    title_to_order[s['title']] = s['order_num']

print("\n=== MAIN SECTIONS (title -> order_num) ===")
for title, order_num in sorted(title_to_order.items(), key=lambda x: int(x[1]) if x[1].isdigit() else 999):
    print(f"{order_num}: {title}")

# Get unique parent_id values from child sections (these are order_nums of parents)
parent_order_nums = set()
for s in child_sections:
    try:
        parent_order_nums.add(int(s['parent_id']))
    except:
        pass

print(f"\n=== PARENT ORDER_NUMS REFERENCED BY CHILDREN ===")
for order_num in sorted(parent_order_nums):
    count = sum(1 for s in child_sections if s['parent_id'] == str(order_num))
    print(f"order_num: {order_num} ({count} children)")

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

for s in child_sections:
    # Find the parent section's title by order_num
    parent_order = s['parent_id']
    parent_title = None
    for ms in main_sections:
        if ms['order_num'] == parent_order:
            parent_title = ms['title']
            break

    if not parent_title:
        print(f"Warning: Could not find parent title for order_num={parent_order}")
        print(f"  Child title: {s['title']}")
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

print(f"\nCorrected SQL file written to: C:\\Users\\fujitsu\\Desktop\\fly-book\\pvp_insert_corrected.sql")
print(f"Total lines: {len(output_lines)}")
