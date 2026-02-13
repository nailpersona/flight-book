import re
from collections import defaultdict

with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse INSERT statements that may span multiple lines
pattern = r'INSERT INTO guide_sections.*?\);'
matches = re.findall(pattern, content, re.DOTALL)

def parse_values(values_str):
    parts = []
    idx = 0
    while idx < len(values_str) and values_str[idx] == ' ':
        idx += 1
    start = idx
    while idx < len(values_str) and values_str[idx] != ',':
        idx += 1
    parts.append(values_str[start:idx].strip())
    idx += 1
    while idx < len(values_str) and values_str[idx] == ' ':
        idx += 1
    start = idx
    while idx < len(values_str) and values_str[idx] != ',':
        idx += 1
    parts.append(values_str[start:idx].strip())
    idx += 1
    while idx < len(values_str) and values_str[idx] == ' ':
        idx += 1
    if idx < len(values_str) and values_str[idx] == "'":
        idx += 1
        start = idx
        while idx < len(values_str):
            if values_str[idx] == "'" and (idx == 0 or values_str[idx-1] != "\\"):
                break
            idx += 1
        title = values_str[start:idx]
        parts.append(f"'{title}'")
        idx += 1
    while idx < len(values_str) and (values_str[idx] == ' ' or values_str[idx] == ','):
        idx += 1
    start = idx
    if idx < len(values_str) and values_str[idx:idx+2] == '$$':
        idx += 2
        start = idx
        while idx < len(values_str) - 1:
            if values_str[idx:idx+2] == '$$':
                break
            idx += 1
        content = f"$${values_str[start:idx]}$$"
        parts.append(content)
        idx += 2
    else:
        while idx < len(values_str) and values_str[idx] != ',':
            idx += 1
        parts.append(values_str[start:idx].strip())
    while idx < len(values_str) and (values_str[idx] == ' ' or values_str[idx] == ','):
        idx += 1
    start = idx
    while idx < len(values_str):
        idx += 1
    parts.append(values_str[start:idx].strip())
    return parts

all_sections = []
level_1_sections = []
children_by_parent_id = defaultdict(list)
order_to_section = {}

for match in matches:
    values_match = re.search(r'VALUES \((.*?)\);', match, re.DOTALL)
    if values_match:
        values_str = values_match.group(1)
        parts = parse_values(values_str)
        if len(parts) >= 5:
            doc_id = parts[0]
            parent_id = parts[1]
            title = parts[2].strip("'\"")
            content = parts[3]
            order_num = parts[4]
            entry = {'doc_id': doc_id, 'parent_id': parent_id, 'title': title, 'content': content, 'order_num': order_num}
            all_sections.append(entry)
            try:
                order_num_int = int(order_num)
                order_to_section[order_num_int] = entry
            except:
                pass

print(f'Total sections: {len(all_sections)}')
print(f'order_to_section entries: {len(order_to_section)}')

for section in all_sections:
    parent_id = section['parent_id']
    if parent_id == 'NULL':
        level_1_sections.append(section)
    else:
        try:
            pid = int(parent_id)
            children_by_parent_id[pid].append(section)
        except:
            pass

print(f'Level 1: {len(level_1_sections)}')
print(f'Unique parent IDs in children: {len(children_by_parent_id)}')

# Check which parent IDs don't have matching order_num
missing_parents = [pid for pid in children_by_parent_id.keys() if pid not in order_to_section]
print(f'Parent IDs without matching order_num: {sorted(missing_parents)}')

# Count children that would be inserted
insertable_children = sum(len(children_by_parent_id[pid]) for pid in children_by_parent_id if pid in order_to_section)
print(f'Children that can be inserted: {insertable_children}')
print(f'Children that cannot be inserted (parent not found): {sum(len(children_by_parent_id[pid]) for pid in children_by_parent_id if pid not in order_to_section)}')
