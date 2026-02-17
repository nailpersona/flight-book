import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// SECURITY: No hardcoded credentials - must be provided via environment or app config
const getConfig = () => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants?.expoConfig?.extra?.supabaseUrl;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants?.expoConfig?.extra?.supabaseAnonKey;

  if (!url || !key) {
    throw new Error(
      'Supabase configuration missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
      'in .env file or app.json under expo.extra'
    );
  }

  return { url, key };
};

const { url: SUPABASE_URL, key: SUPABASE_ANON_KEY } = getConfig();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
