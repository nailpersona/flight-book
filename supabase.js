import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Environment variables для production (зібрані білди)
// Fallback значення тільки для розробки (повинні бути замінені на .env)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants?.expoConfig?.extra?.supabaseUrl ||
  'https://klqxadvtvxvizgdjmegx.supabase.co';

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants?.expoConfig?.extra?.supabaseAnonKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhhZHZ0dnh2aXpnZGptZWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzI3ODEsImV4cCI6MjA4NjIwODc4MX0.ev6yogjEETj3X49_KSBjt9FIxloQsB8kDbpjutUioQ8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
