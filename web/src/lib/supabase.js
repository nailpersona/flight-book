import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://klqxadvtvxvizgdjmegx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhhZHZ0dnh2aXpnZGptZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzI3ODEsImV4cCI6MjA4NjIwODc4MX0.ev6yogjEETj3X49_KSBjt9FIxloQsB8kDbpjutUioQ8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
