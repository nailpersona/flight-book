# -*- coding: utf-8 -*-
# Debug version to see what's being parsed

import re

# Read source file
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse each INSERT statement
pattern = r'INSERT INTO guide_sections.*?\);'
matches = re.findall(pattern, content, re.DOTALL)

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

    if len(parts) != 5:
        print(f'WARNING: Unexpected part count: {len(parts)}')
        print(f'Line: {line[:200]}')
        print(f'Parts: {parts}')

    return parts

# Parse first 20 sections
count = 0
all_sections = []

for match in matches[:20]:
    parts = parse_insert_line(match)
    if parts and len(parts) >= 5:
        count += 1
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

print(f'Parsed {count} sections (first 20)')

# Now parse all
count = 0
for match in matches:
    parts = parse_insert_line(match)
    if parts and len(parts) >= 5:
        count += 1

print(f'Total sections parsed: {count}')
