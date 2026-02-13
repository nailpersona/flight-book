import os
import re
from supabase import create_client, Client

# Initialize Supabase client
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
client = Client(url, key)

# Read SQL file
sql_file = r"C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql"
with open(sql_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Get existing order_nums from database
existing_data = client.table('guide_sections').select('order_num').eq('document_id', 1).execute()
existing_nums = {item['order_num'] for item in existing_data.data}
print(f"Existing order_nums: {len(existing_nums)} entries")

# Parse all INSERT statements from SQL
inserts = []
lines = content.split('\n')
current_stmt = ''

for line in lines:
    stripped = line.strip()
    if stripped.startswith('INSERT INTO guide_sections'):
        if current_stmt:
            inserts.append(current_stmt)
        current_stmt = stripped
    elif current_stmt:
        current_stmt += '\n' + line
        if stripped.endswith(';'):
            current_stmt = current_stmt.rstrip().rstrip(';')
            inserts.append(current_stmt)
            current_stmt = ''

print(f"Total INSERT statements in SQL: {len(inserts)}")

# Parse each INSERT to extract order_num
missing_inserts = []
for insert in inserts:
    # Extract order_num from INSERT statement
    match = re.search(r'order_num\)\s*VALUES\s*\(\d+,\s*(\d+|NULL),\s*[\'"]([^\'"]*)[\'"],\s*(\d+)\)', insert)
    if not match:
        match = re.search(r'order_num\)\s*VALUES\s*\((\d+),\s*(\d+|NULL),\s*[\'"]([^\'"]*)[\'"],\s*\$\$[^$]*\$\$,\s*(\d+)\)', insert)

    if match:
        doc_id = int(match.group(1))
        parent_id = match.group(2)
        title = match.group(3)
        order_num = int(match.group(4))

        if doc_id == 1 and order_num not in existing_nums:
            missing_inserts.append((order_num, insert))

print(f"Missing sections: {len(missing_inserts)}")
print(f"Missing order_nums: sorted({[x[0] for x in missing_inserts[:20]]}...)")

# Execute missing inserts
batch_size = 20
imported = 0
failed = 0

for i in range(0, len(missing_inserts), batch_size):
    batch = missing_inserts[i:i+batch_size]
    print(f'Processing batch {i//batch_size + 1}/{(len(missing_inserts)-1)//batch_size + 1}...')

    for order_num, insert in batch:
        try:
            # Execute the raw SQL via Supabase
            result = client.rpc('exec_sql', {'sql_query': insert})
            imported += 1
            print(f"  Inserted order_num {order_num}")
        except Exception as e:
            # Try parsing and inserting via API instead
            try:
                match = re.search(
                    r'INSERT INTO guide_sections \(document_id, parent_id, title, content, order_num\) VALUES '
                    r'\((\d+), ([\d]+|NULL), \'([^\']*)\'(?:, \$\$(.*?)\$\$|, NULL), (\d+)\)',
                    insert, re.DOTALL
                )
                if match:
                    doc_id = int(match.group(1))
                    parent_id = None if match.group(2) == 'NULL' else int(match.group(2))
                    title = match.group(3).replace("''", "'")  # Handle escaped quotes
                    content = match.group(4) if match.group(4) != 'NULL' else None
                    order_num = int(match.group(5))

                    # Insert via API
                    client.table('guide_sections').insert({
                        'document_id': doc_id,
                        'parent_id': parent_id,
                        'title': title,
                        'content': content,
                        'order_num': order_num
                    }).execute()
                    imported += 1
                    print(f"  Inserted order_num {order_num} via API")
            except Exception as e2:
                failed += 1
                print(f'  Error inserting order_num {order_num}: {e2}')

print(f'\nDone! Imported: {imported}, Failed: {failed}')
