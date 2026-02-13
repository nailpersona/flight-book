# -*- coding: utf-8 -*-
from docx import Document
import json

doc = Document(r'C:\Users\fujitsu\Desktop\fly-book\docs\ПВП ДАУ наказ №2 від 05.01.2015.docx')

# Extract all paragraphs
all_paragraphs = []
for para in doc.paragraphs:
    text = para.text.strip()
    if text:
        all_paragraphs.append(text)

# Define the main subsection headers we're looking for
subsection_headers = [
    "1. Склад екіпажу повітряного судна",
    "2. Допуски льотного складу до польотів",
    "3. Перевірки льотного складу",
    "4. Допустимі перерви у польотах та порядок відновлення втрачених навичок льотним складом",
    "5. Норми нальоту і відпочинку льотного складу"
]

# Find section 2 and organize by subsections
in_section_2 = False
subsection_contents = {header: [] for header in subsection_headers}
current_subsection = None

for text in all_paragraphs:
    # Look for section 2 header
    if not in_section_2 and 'Екіпаж повітряного судна' in text and text.startswith('ІІ.'):
        in_section_2 = True
        continue

    # Look for next main section (III) to stop
    if in_section_2 and text.startswith('ІІІ.'):
        break

    # If we found section 2, organize content by subsection
    if in_section_2:
        # Check if this is a subsection header
        found_header = None
        for header in subsection_headers:
            if text.startswith(header):
                found_header = header
                break

        if found_header:
            current_subsection = found_header
            subsection_contents[current_subsection].append(text)
        elif current_subsection:
            subsection_contents[current_subsection].append(text)

# Format the content for each subsection
formatted_sections = {}
for header in subsection_headers:
    content = subsection_contents[header]
    if content:
        formatted_sections[header] = '\n\n'.join(content)

# Write to JSON file
with open(r'C:\Users\fujitsu\Desktop\fly-book\section2_final.json', 'w', encoding='utf-8') as f:
    json.dump(formatted_sections, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(formatted_sections)} subsections")
for header, content in formatted_sections.items():
    print(f"  - {header[:60]}... ({len(content)} chars)")
