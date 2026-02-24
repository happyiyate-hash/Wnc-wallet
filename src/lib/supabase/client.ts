
'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * PRIMARY AUTHENTICATION SUPABASE CLIENT
 * 
 * Used for user authentication, profiles, and encrypted vault storage.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lbltgeldesxkgdrblfxj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
