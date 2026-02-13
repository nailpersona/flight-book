import re
from collections import defaultdict

with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse sections more carefully
sections = []
for line in content.split('\n'):
    if 'INSERT INTO' in line:
        match = re.search(r'VALUES \(1, (\d+|NULL), \'([^\']*)\', (\$\$.*?\$\$|NULL), (\d+)\);', line, re.DOTALL)
        if match:
            parent_id = match.group(1)
            title = match.group(2)
            order_num = int(match.group(4))
            sections.append({'parent_id': parent_id, 'title': title, 'order_num': order_num})

print(f'Parsed {len(sections)} sections')

# Build order->section map
order_to_section = {s['order_num']: s for s in sections}

# Check children
children_by_parent_id = defaultdict(list)
for section in sections:
    if section['parent_id'] != 'NULL':
        children_by_parent_id[int(section['parent_id'])].append(section)

print(f'Unique parent IDs: {len(children_by_parent_id)}')

# Find parents not in order_to_section
missing = [pid for pid in children_by_parent_id.keys() if pid not in order_to_section]
print(f'Parent IDs not in order_to_section: {sorted(missing)}')
