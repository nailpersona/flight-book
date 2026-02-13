# -*- coding: utf-8 -*-
from docx import Document
import json
import re

doc = Document(r'C:\Users\fujitsu\Desktop\fly-book\docs\ПВП ДАУ наказ №2 від 05.01.2015.docx')

# Extract all paragraphs
all_paragraphs = []
for para in doc.paragraphs:
    text = para.text.strip()
    if text:
        all_paragraphs.append(text)

# Find section 2 and its subsections
in_section_2 = False
section_2_content = {}
current_subsection = None
current_content = []
subsection_order = 0

# Pattern for subsection headers like "1. Склад...", "2. Допуски..."
subsection_pattern = re.compile(r'^\d+\.\s+[А-ЯІЇЄҐ]')

for i, text in enumerate(all_paragraphs):
    # Look for section 2 header
    if not in_section_2 and ('Екіпаж повітряного судна' in text):
        in_section_2 = True
        section_2_content['_header'] = text
        continue

    # Look for next main section (III) to stop
    if in_section_2 and (text.startswith('ІІІ.') or text.startswith('III.')):
        break

    # If we found section 2, look for subsections
    if in_section_2:
        # Check if this is a subsection header
        if subsection_pattern.match(text) or (text[0].isdigit() and text[1] in '. ' and len(text) > 4):
            # Save previous subsection if exists
            if current_subsection:
                section_2_content[current_subsection] = {
                    'order': subsection_order,
                    'content': '\n\n'.join(current_content)
                }
                subsection_order += 1
                current_content = []

            # Start new subsection
            current_subsection = text
        elif current_subsection:
            current_content.append(text)
        else:
            # Content before first subsection
            current_content.append(text)

# Save last subsection
if current_subsection:
    section_2_content[current_subsection] = {
        'order': subsection_order,
        'content': '\n\n'.join(current_content)
    }

# Write to JSON file
with open(r'C:\Users\fujitsu\Desktop\fly-book\section2_subsections.json', 'w', encoding='utf-8') as f:
    json.dump(section_2_content, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(section_2_content)} items from section 2")
print("Subsections:")
for key in section_2_content.keys():
    if key != '_header':
        content_len = len(section_2_content[key]['content']) if 'content' in section_2_content[key] else 0
        print(f"  - {key[:80]}... ({content_len} chars)")
