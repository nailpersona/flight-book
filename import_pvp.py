import os
from supabase import create_client, Client

# Read SQL file
sql_file = r"C:\Users\fujitsu\Desktop\fly-book\pvp_sections_clean.sql"

with open(sql_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Initialize Supabase client
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
client = Client(url, key)

# Extract INSERT statements
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

# Execute in batches of 50
batch_size = 50
for i in range(0, len(inserts), batch_size):
    batch = inserts[i:i+batch_size]
    print(f'Processing batch {i//batch_size + 1}/{(len(inserts)-1)//batch_size + 1}...')

    # Parse values from INSERT
    for insert in batch:
        # Extract data from: VALUES (1, NULL, 'Title', $$content$$, 1);
        match = insert.match(r"INSERT INTO guide_sections \(document_id, parent_id, title, content, order_num\) VALUES \((\d+), ([\d]+|NULL), '([^']+)'(?:, \$\$(.*?)\$\$|, NULL), (\d+)\);")
        if match:
            doc_id = int(match[1])
            parent_id = None if match[2] == 'NULL' else int(match[2])
            title = match[3]
            content = None if match[4] == 'NULL' else match[5]
            order_num = int(match[6])

            try:
                client.table('guide_sections').insert({
                    'document_id': doc_id,
                    'parent_id': parent_id,
                    'title': title,
                    'content': content,
                    'order_num': order_num
                }).execute()
            except Exception as e:
                print(f'Error inserting "{title}": {e}')

print(f'Done! Inserted {len(inserts)} sections.')
