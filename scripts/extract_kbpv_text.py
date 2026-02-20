"""
Extract text from .doc files in КБП-В-2018 folder.
Uses win32com to read old Word .doc format.
"""

import os
import sys

# Try win32com first (Windows with Word installed)
try:
    import win32com.client
    USE_WIN32COM = True
except ImportError:
    USE_WIN32COM = False
    print("Warning: win32com not available, trying alternative methods")

def extract_with_win32com(doc_path):
    """Extract text using Word COM automation."""
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    try:
        doc = word.Documents.Open(doc_path)
        text = doc.Content.Text
        doc.Close(False)
        return text
    finally:
        word.Quit()

def extract_doc_text(doc_path):
    """Extract text from a .doc file."""
    if USE_WIN32COM:
        return extract_with_win32com(doc_path)
    else:
        raise RuntimeError("No .doc extraction method available")

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    source_dir = os.path.join(base_dir, "docs", "КБП-В-2018")
    output_file = os.path.join(base_dir, "docs", "КБПВ-18_text.txt")

    # Collect all .doc files
    doc_files = []
    for root, dirs, files in os.walk(source_dir):
        for f in files:
            if f.endswith('.doc') and not f.startswith('._'):
                doc_files.append(os.path.join(root, f))

    doc_files.sort()

    print(f"Found {len(doc_files)} .doc files")

    # Extract text from each file
    all_text = []
    all_text.append("# КБП В (КБПВ-18) - Курс бойової підготовки вертольотів\n")
    all_text.append("# Екстраговано з docs/КБП-В-2018/\n\n")

    for doc_path in doc_files:
        rel_path = os.path.relpath(doc_path, source_dir)
        print(f"Processing: {rel_path}")

        try:
            text = extract_doc_text(doc_path)

            # Add section marker
            all_text.append(f"\n{'='*80}\n")
            all_text.append(f"# FILE: {rel_path}\n")
            all_text.append(f"{'='*80}\n\n")
            all_text.append(text)
            all_text.append("\n")

            print(f"  -> {len(text)} chars extracted")
        except Exception as e:
            print(f"  -> ERROR: {e}")
            all_text.append(f"\n# ERROR processing {rel_path}: {e}\n")

    # Write output
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(''.join(all_text))

    print(f"\nOutput written to: {output_file}")
    print(f"Total size: {os.path.getsize(output_file)} bytes")

if __name__ == "__main__":
    main()
