
'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * DEDICATED LOGO & METADATA SUPABASE CLIENT
 * 
 * This instance is strictly for fetching token logos and network metadata.
 * It uses a different Supabase project than the primary application auth.
 */

const logoSupabaseUrl = process.env.NEXT_PUBLIC_LOGO_SUPABASE_URL || 'https://gcghriodmljkusdduhzl.supabase.co';
const logoSupabaseAnonKey = process.env.NEXT_PUBLIC_LOGO_SUPABASE_ANON_KEY;

export const logoSupabase = logoSupabaseUrl && logoSupabaseAnonKey 
  ? createClient(logoSupabaseUrl, logoSupabaseAnonKey)
  : null;
