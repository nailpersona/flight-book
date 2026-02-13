#!/usr/bin/env python3
import re

# Read the SQL file
with open(r'C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Split by INSERT statements and parse each
lines = content.split('\n')
sections = []

for i, line in enumerate(lines):
    if line.strip().startswith('INSERT INTO guide_sections'):
        # Parse the VALUES part
        match = re.search(r'VALUES \((.*?)\);', line, re.DOTALL)
        if not match:
            continue

        values_str = match.group(1)

        # Need to parse carefully handling $$...$$ and '...' strings
        document_id = '1'
        parent_id = None
        title = ''
        content = None
        order_num = None

        # Find document_id (first value)
        doc_match = re.match(r'(\d+)', values_str)
        if doc_match:
            document_id = doc_match.group(1)

        # Find parent_id (second value) - either NULL or a number
        after_doc = values_str[len(document_id):].lstrip()
        if after_doc.startswith(', NULL'):
            parent_id = 'NULL'
            # Skip past NULL
            remaining = after_doc[6:].lstrip()
        elif after_doc.startswith(','):
            # Check if NULL follows
            rest = after_doc[1:].lstrip()
            if rest.startswith('NULL'):
                parent_id = 'NULL'
                remaining = rest[4:].lstrip()
            else:
                # Should be a number
                pid_match = re.match(r'(\d+)', rest)
                if pid_match:
                    parent_id = pid_match.group(1)
                    remaining = rest[len(parent_id):].lstrip()
                else:
                    parent_id = None
                    remaining = rest
        else:
            parent_id = None
            remaining = after_doc

        # Find title - either in single quotes or after the comma
        if remaining.startswith("'"):
            # Single-quoted title
            title_end = remaining.find("',", 1)
            if title_end == -1:
                # Try looking for NULL or $$ after title
                title_end = remaining.find("'", 1)
            title = remaining[1:title_end]
            # Move past title
            remaining = remaining[title_end + 1:].strip().lstrip(',').strip()
        else:
            # Skip to first quote
            quote_pos = remaining.find("'")
            if quote_pos != -1:
                title_end = remaining.find("',", quote_pos + 1)
                if title_end == -1:
                    title_end = remaining.find("'", quote_pos + 1)
                title = remaining[quote_pos + 1:title_end]
                remaining = remaining[title_end + 1:].strip().lstrip(',').strip()

        # Content is either NULL or $$...$$ - skip it to find order_num
        if remaining.startswith('NULL'):
            remaining = remaining[4:].strip().lstrip(',').strip()
        elif remaining.startswith('$$'):
            # Skip dollar-quoted string
            end_pos = remaining.find('$$', 2)
            if end_pos != -1:
                remaining = remaining[end_pos + 2:].strip().lstrip(',').strip()
            else:
                # Find end at line boundary
                remaining = remaining.split('$$')[-1].strip().lstrip(',').strip()

        # order_num is the last value
        order_match = re.search(r'(\d+)\s*$', remaining)
        if order_match:
            order_num = order_match.group(1)

        sections.append({
            'index': i,
            'document_id': document_id,
            'parent_id': parent_id,
            'title': title,
            'order_num': order_num
        })

# Separate main sections (NULL parent) from child sections
main_sections = [s for s in sections if s['parent_id'] == 'NULL']
child_sections = [s for s in sections if s['parent_id'] != 'NULL']

print(f"Total INSERT statements found: {len(sections)}")
print(f"Main sections (parent_id IS NULL): {len(main_sections)}")
print(f"Child sections: {len(child_sections)}")

# Print main section titles for mapping
print("\n=== MAIN SECTIONS (title -> order_num) ===")
for s in sorted(main_sections, key=lambda x: int(x['order_num']) if x['order_num'] and x['order_num'].isdigit() else 0):
    print(f"{s['order_num']}: {s['title']}")

# Get unique parent_id values from child sections
parent_ids = set(s['parent_id'] for s in child_sections if s['parent_id'] is not None)
print(f"\n=== UNIQUE PARENT IDs IN CHILD SECTIONS ===")
for pid in sorted(parent_ids, key=lambda x: int(x) if x.isdigit() else 0):
    count = sum(1 for s in child_sections if s['parent_id'] == pid)
    print(f"parent_id: {pid} ({count} children)")
