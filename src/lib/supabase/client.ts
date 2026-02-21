'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Safe client initialization. 
 * Even if the Supabase project is paused, the client can be initialized
 * as long as the URL and Key are syntactically valid.
 */
export const supabase = 
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
