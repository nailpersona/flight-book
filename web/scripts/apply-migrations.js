const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase credentials
const supabaseUrl = 'https://klqxadvtvxvizgdjmegx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhkdHZ0eHZpemdkam1lZ3giLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzQwNjM0MzY5LCJleHAiOjIwNTYyMTAzNjl9.SfqBBBqC6zPHe_0rH2JY0R6ZZVBzqGGGGGGGGGGGGGG';

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Sections that still need to be updated
const sectionsToUpdate = [805, 806, 807, 808, 825, 826, 828, 829, 830, 831, 832];

async function applyMigrations() {
  for (const sectionId of sectionsToUpdate) {
    const filePath = path.join(__dirname, `update_${sectionId}.sql`);

    if (!fs.existsSync(filePath)) {
      console.log(`File not found: update_${sectionId}.sql`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        console.log(`Error updating section ${sectionId}:`, error.message);
      } else {
        console.log(`Successfully updated section ${sectionId}`);
      }
    } catch (err) {
      console.log(`Error updating section ${sectionId}:`, err.message);
    }
  }
}

applyMigrations().then(() => {
  console.log('Done!');
}).catch(console.error);
