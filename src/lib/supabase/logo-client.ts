
'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * DEDICATED LOGO & METADATA SUPABASE CLIENT (gcghriodmljkusdduhzl)
 * This is the ONLY client used for fetching token branding and network registries.
 */

const logoSupabaseUrl = process.env.NEXT_PUBLIC_LOGO_SUPABASE_URL || 'https://gcghriodmljkusdduhzl.supabase.co';
const logoSupabaseAnonKey = process.env.NEXT_PUBLIC_LOGO_SUPABASE_ANON_KEY || '';

if (!logoSupabaseAnonKey) {
  console.warn("[LOGO_CLIENT_ADVISORY] Logo Supabase keys are missing.");
}

export const logoSupabase = (logoSupabaseUrl && logoSupabaseAnonKey)
  ? createClient(logoSupabaseUrl, logoSupabaseAnonKey)
  : null;
