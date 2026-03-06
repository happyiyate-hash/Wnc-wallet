
'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * PRIMARY AUTHENTICATION SUPABASE CLIENT (lbltgeldesxkgdrblfxj)
 * Used for user authentication, profiles, and encrypted vault storage.
 * Hardened to prevent silent failures if keys are missing.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lbltgeldesxkgdrblfxj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn("[AUTH_CLIENT_ADVISORY] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Identity handshakes will be disabled.");
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
