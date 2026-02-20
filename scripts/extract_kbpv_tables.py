"""
Extract tables from .doc files and save as PNG images.
Uses win32com with Word and Excel for high-quality table rendering.
"""

import os
import win32com.client
import pythoncom

def extract_tables_from_doc(doc_path, output_dir, prefix):
    """Extract all tables from a Word document and save as PNG."""
    tables_info = []

    # Initialize COM
    pythoncom.CoInitialize()

    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    excel = win32com.client.Dispatch("Excel.Application")
    excel.Visible = False

    try:
        doc = word.Documents.Open(doc_path)
        tables = doc.Tables
        print(f"  Found {tables.Count} tables")

        for i in range(1, tables.Count + 1):
            table = tables.Item(i)

            # Copy table
            table.Range.Copy()

            # Create new Excel workbook
            wb = excel.Workbooks.Add()
            ws = wb.Worksheets.Item(1)
            ws.Paste()

            # Auto-fit columns
            ws.UsedRange.Columns.AutoFit()

            # Get range
            used_range = ws.UsedRange

            # Export as image
            output_file = os.path.join(output_dir, f"{prefix}_table_{i:02d}.png")

            # Copy range as picture
            used_range.CopyPicture(Appearance=1, Format=2)  # 1=xlScreen, 2=xlBitmap

            # Create chart to export
            chart = ws.ChartObjects().Add(0, 0, used_range.Width + 10, used_range.Height + 10).Chart
            chart.Paste()
            chart.Export(output_file)
            ws.ChartObjects(1).Delete()

            wb.Close(False)

            tables_info.append({
                "index": i,
                "file": os.path.basename(output_file),
                "rows": table.Rows.Count,
                "cols": table.Columns.Count
            })
            print(f"    -> {os.path.basename(output_file)} ({table.Rows.Count}x{table.Columns.Count})")

        doc.Close(False)

    except Exception as e:
        print(f"  ERROR: {e}")
    finally:
        excel.Quit()
        word.Quit()
        pythoncom.CoUninitialize()

    return tables_info

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    source_dir = os.path.join(base_dir, "docs", "КБП-В-2018")
    output_dir = os.path.join(base_dir, "web", "public", "images", "tables")

    os.makedirs(output_dir, exist_ok=True)

    # Collect all .doc files
    doc_files = []
    for root, dirs, files in os.walk(source_dir):
        for f in files:
            if f.endswith('.doc') and not f.startswith('._'):
                doc_files.append(os.path.join(root, f))

    doc_files.sort()

    print(f"Processing {len(doc_files)} .doc files for tables...")

    all_tables = {}

    for doc_path in doc_files:
        rel_path = os.path.relpath(doc_path, source_dir)
        prefix = rel_path.replace('/', '_').replace('\\', '_').replace(' ', '_').replace('.doc', '')
        prefix = f"kbpv_{prefix[:30]}"  # Limit prefix length

        print(f"\nProcessing: {rel_path}")

        try:
            tables = extract_tables_from_doc(doc_path, output_dir, prefix)
            all_tables[rel_path] = tables
        except Exception as e:
            print(f"  FAILED: {e}")

    # Summary
    total = sum(len(t) for t in all_tables.values())
    print(f"\n{'='*60}")
    print(f"Total tables extracted: {total}")
    print(f"Output directory: {output_dir}")

if __name__ == "__main__":
    main()
