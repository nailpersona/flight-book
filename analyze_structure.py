#!/usr/bin/env python3
import re
from collections import defaultdict

# Read the SQL file
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse to build a complete mapping of title to properties
sections = {}

# Extract all id values that appear in the file (from previous exports)
# But actually, we need to extract the actual INSERT statements and parse them

lines = content.split('\n')
for line_num, line in enumerate(lines, 1):
    line = line.strip()
    if not line or not line.startswith('INSERT INTO guide_sections'):
        continue

    # Parse the VALUES part
    # Format: (document_id, parent_id, title, content, order_num)

    # Simple regex to extract the 5 values
    match = re.search(r"VALUES\s*\(\s*1,\s*(\d+|NULL),\s*'([^']*(?:''[^']*)*)',\s*(.+?),\s*(\d+)\s*\)\s*;", line, re.DOTALL)
    if not match:
        # Try with $$ for content
        match = re.search(r"VALUES\s*\(\s*1,\s*(\d+|NULL),\s*'([^']*(?:''[^']*)*)',\s*\$\$.*?\$\$,\s*(\d+)\s*\)\s*;", line, re.DOTALL)

    if match:
        parent_id = match.group(1)
        title = match.group(2)
        order_num = match.group(3)
        sections[title] = {
            'parent_id': parent_id,
            'order_num': order_num,
            'line': line
        }

print(f"Total sections parsed: {len(sections)}")

# Build parent_id -> titles mapping
parent_to_children = defaultdict(list)
for title, info in sections.items():
    if info['parent_id'] != 'NULL':
        parent_to_children[info['parent_id']].append(title)

print(f"\n=== PARENT IDs AND THEIR CHILDREN ===")
for parent_id in sorted(parent_to_children.keys(), key=lambda x: int(x) if x.isdigit() else 0):
    children = parent_to_children[parent_id]
    print(f"\nparent_id: {parent_id} ({len(children)} children):")
    for child in children[:5]:  # Show first 5
        print(f"  - {child[:80]}")
    if len(children) > 5:
        print(f"  ... and {len(children) - 5} more")

# Now we need to find which sections have these as IDs
# But wait - the parent_id values in the SQL are the DATABASE IDs from the original export
# We need to find all main sections (parent_id = NULL) and then understand the hierarchy

main_sections = {title: info for title, info in sections.items() if info['parent_id'] == 'NULL'}
print(f"\n=== MAIN SECTIONS (parent_id = NULL) === {len(main_sections)}")
for title, info in sorted(main_sections.items(), key=lambda x: int(x[1]['order_num']) if x[1]['order_num'].isdigit() else 999):
    print(f"order {info['order_num']}: {title}")

# The issue: parent_ids like 162, 201, 92 refer to OTHER rows in the SAME export
# We need to match them by title

# Build a title-to-title hierarchy
print(f"\n=== BUILDING TITLE MAPPING ===")

# First, get all unique parent_id values that are not NULL
all_parent_ids = set(info['parent_id'] for info in sections.values() if info['parent_id'] != 'NULL')
print(f"Unique non-NULL parent_id values: {len(all_parent_ids)}")

# These parent_ids must be IDs that were assigned to some sections in the original DB
# But we don't have that mapping directly. However, we can infer it from the structure:
# - parent_id values point to OTHER sections in this document
# - We need to match children to parents by title

# Let's find all sections that could be parents (have children)
parent_titles = set()
for parent_id in all_parent_ids:
    # Find which title has this as its ID in the original export
    # But we don't have that info directly
    pass

# Instead, let's look for patterns - child titles that start with a number
# and might reference a parent by that number or title prefix

print(f"\n=== ANALYZING CHILD TITLES ===")
# Get a few example children
for parent_id in ['92', '162', '201']:
    if parent_id in parent_to_children:
        print(f"\nChildren of parent_id {parent_id}:")
        for child in parent_to_children[parent_id][:3]:
            print(f"  - {child[:100]}")
