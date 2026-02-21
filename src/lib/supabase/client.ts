'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Robust check to prevent crash during SSR if env vars are missing or invalid
const isValidUrl = (url: string | undefined): boolean => {
  if (!url || url === 'undefined' || url === '') return false;
  try {
    return url.startsWith('http');
  } catch {
    return false;
  }
};

export const supabase = 
  isValidUrl(supabaseUrl) && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
