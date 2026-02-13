# -*- coding: utf-8 -*-
# Simple, robust SQL parser that inserts all sections in order_num order

import re

# Read source file
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse each INSERT statement
pattern = r'INSERT INTO guide_sections.*?\);'
matches = re.findall(pattern, content, re.DOTALL)

print(f"Found {len(matches)} INSERT statements")

def parse_insert_line(line):
    """Parse a single INSERT statement line."""
    # Extract the VALUES part
    values_match = re.search(r'VALUES \((.*?)\);', line, re.DOTALL)
    if not values_match:
        return None

    values_str = values_match.group(1)

    # Split by comma, handling $$ quoted strings
    parts = []
    i = 0
    current = ''
    in_dollars = False

    while i < len(values_str):
        char = values_str[i]

        # Check for $$ delimiter
        if not in_dollars and char == '$' and i + 1 < len(values_str) and values_str[i+1] == '$':
            in_dollars = True
            current += char
            i += 2
            current += char
            i += 1
            continue

        if in_dollars:
            current += char
            i += 1
            # Check for end of $$
            if current.endswith('$$'):
                in_dollars = False
            continue

        if char == ',' and not in_dollars:
            parts.append(current.strip())
            current = ''
            i += 1
            continue

        current += char
        i += 1

    if current.strip():
        parts.append(current.strip())

    return parts

# Parse all sections
all_sections = []

for match in matches:
    parts = parse_insert_line(match)
    if parts and len(parts) >= 5:
        doc_id = parts[0].strip()
        parent_id = parts[1].strip()
        title = parts[2].strip("'\"")
        content = parts[3].strip()
        order_num = parts[4].strip()

        all_sections.append({
            'doc_id': doc_id,
            'parent_id': parent_id,
            'title': title,
            'content': content,
            'order_num': order_num
        })

# Sort by order_num (int conversion with fallback)
def safe_order_num(s):
    try:
        return int(s['order_num'])
    except:
        return 0

all_sections.sort(key=safe_order_num)

print(f"Total sections parsed: {len(all_sections)}")

# Count level 1 and child sections
level_1_count = sum(1 for s in all_sections if s['parent_id'] == 'NULL')
child_count = len(all_sections) - level_1_count

print(f"Level 1 sections (parent_id = NULL): {level_1_count}")
print(f"Child sections: {child_count}")

# Create SQL output
output_lines = []
output_lines.append("-- PVP Document Sections - Final SQL")
output_lines.append("-- All sections inserted in order_num order")
output_lines.append("-- Document ID: 1 (ПВП ДАУ)")
output_lines.append("")
output_lines.append("BEGIN;")
output_lines.append("")
output_lines.append("INSERT INTO guide_sections (document_id, parent_id, title, content, order_num) VALUES")

# Group into batches for readability
batch_size = 50
for i in range(0, len(all_sections), batch_size):
    batch = all_sections[i:i+batch_size]
    batch_values = []
    for section in batch:
        title = section['title'].replace("'", "''")
        content = section['content']
        order_num = section['order_num']
        parent_id = section['parent_id']
        batch_values.append(f"(1, {parent_id}, '{title}', {content}, {order_num})")

    output_lines.append(',\n'.join(batch_values) + ';')

output_lines.append("")
output_lines.append("COMMIT;")

# Write final SQL file
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_final.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print(f"Final SQL file created: pvp_sections_final.sql")
print(f"Total sections: {len(all_sections)}")
