# -*- coding: utf-8 -*-
import re
import json
from collections import defaultdict

# Read the source file with proper encoding
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse each INSERT statement
sections = []
lines = content.split('\n')

for line in lines:
    line = line.strip()
    if line.startswith('INSERT INTO'):
        sections.append(line)

print(f'Total sections: {len(sections)}')

# Parse each section
def parse_values(values_str):
    """Parse the VALUES part carefully handling $$ strings"""
    parts = []
    current = ''
    paren_depth = 0
    dollar_count = 0

    i = 0
    while i < len(values_str):
        char = values_str[i]

        # Handle $$ delimiter for content
        if char == '$':
            if i + 1 < len(values_str) and values_str[i+1] == '$':
                if dollar_count == 0:
                    # Start of $$ string
                    dollar_count = 2
                    i += 2
                    current += '$$'
                    continue
                elif dollar_count == 2:
                    # End of $$ string
                    dollar_count = 0
                    current += '$$'
                    i += 2
                    continue
        elif dollar_count == 2:
            # Inside $$ string
            current += char
            i += 1
            continue

        # Handle parentheses for arrays
        if char == '{':
            paren_depth += 1
        elif char == '}':
            paren_depth -= 1

        # Handle comma separator
        if char == ',' and paren_depth == 0:
            parts.append(current.strip())
            current = ''
        else:
            current += char

        i += 1

    if current.strip():
        parts.append(current.strip())

    return parts

# Classify sections by level
level_1 = []  # parent_id = NULL
level_2 = []  # Has a parent
level_3 = []

# First, collect all sections with their data
all_sections = []

for section in sections:
    # Extract the VALUES part
    match = re.search(r'VALUES \((.*?)\);', section, re.DOTALL)
    if match:
        values_str = match.group(1)
        parts = parse_values(values_str)

        if len(parts) >= 5:
            doc_id = parts[0]
            parent_id = parts[1]
            title = parts[2].strip("'\"")
            content = parts[3]
            order_num = parts[4]

            entry = {
                'doc_id': doc_id,
                'parent_id': parent_id,
                'title': title,
                'content': content,
                'order_num': order_num,
                'original': section
            }
            all_sections.append(entry)

print(f'Parsed sections: {len(all_sections)}')

# Now classify
title_to_id = {}  # Will map title to original ID for lookup
children_by_parent_id = defaultdict(list)

for section in all_sections:
    parent_id = section['parent_id']
    if parent_id == 'NULL':
        level_1.append(section)
    else:
        # This is a child section
        # Store parent_id reference
        try:
            pid = int(parent_id)
            children_by_parent_id[pid].append(section)
        except:
            pass

print(f'\nLevel 1 (parent_id = NULL): {len(level_1)}')
print(f'Children found: {sum(len(v) for v in children_by_parent_id.values())}')

# Show level 1 sections (with proper UTF-8 output)
print("\n=== Level 1 Sections (first 20) ===")
for i, s in enumerate(level_1[:20]):
    title = s['title']
    print(f"{i+1}. {title}")

# We need to understand the hierarchy better
# The parent_id values in the original SQL refer to IDs that will be generated
# We need to create a mapping by title to reconstruct the hierarchy

# First, let's build the hierarchy by understanding what IDs map to what titles
# The original SQL file has hardcoded parent_id values that reference other rows
# We need to extract those relationships

# Create a mapping from original_id to title
id_to_title = {}  # original_id -> title
title_to_original_id = {}  # title -> original_id

# Extract original IDs from order_num (wait, that's not right)
# The original SQL had ID as first column, but current schema uses auto-increment

# Actually, looking at the original file, it seems like the parent_id references
# are based on some original ID system. We need to figure out the hierarchy.

# Let's look at the pattern: find all unique parent_id values
unique_parent_ids = set()
for section in all_sections:
    pid = section['parent_id']
    if pid != 'NULL':
        try:
            unique_parent_ids.add(int(pid))
        except:
            pass

print(f"\n=== Unique parent_id values ===")
print(f"Total unique parent IDs: {len(unique_parent_ids)}")
print(f"Min parent ID: {min(unique_parent_ids) if unique_parent_ids else 'N/A'}")
print(f"Max parent ID: {max(unique_parent_ids) if unique_parent_ids else 'N/A'}")

# To reconstruct hierarchy, we need to find which sections correspond to which IDs
# The key is that sections with parent_id = NULL have their own IDs

# The original SQL file seems to have used the order_num as a pseudo-ID
# Let's examine the pattern more carefully

# For now, let's create a simpler approach:
# 1. Group sections by title patterns to understand hierarchy
# 2. Look for sections with similar prefixes

print("\n=== Analyzing title patterns ===")
# Sample some titles
sample_titles = [s['title'] for s in all_sections[:50]]
for title in sample_titles:
    print(f"  - {title[:80]}")
