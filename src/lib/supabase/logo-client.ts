
'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * DEDICATED LOGO & METADATA SUPABASE CLIENT (gcghriodmljkusdduhzl)
 * This is the ONLY client used for fetching token branding and network registries.
 * Re-engineered for strict production environment synchronization.
 */

const logoSupabaseUrl = process.env.NEXT_PUBLIC_LOGO_SUPABASE_URL;
const logoSupabaseAnonKey = process.env.NEXT_PUBLIC_LOGO_SUPABASE_ANON_KEY;

if (!logoSupabaseUrl || !logoSupabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn("[LOGO_CLIENT_ADVISORY] Logo Supabase nodes are not configured. Asset branding will use generic fallbacks.");
  }
}

export const logoSupabase = (logoSupabaseUrl && logoSupabaseAnonKey)
  ? createClient(logoSupabaseUrl, logoSupabaseAnonKey)
  : null;

// Export the URL for CDN construction in components
export const LOGO_CDN_URL = logoSupabaseUrl || 'https://gcghriodmljkusdduhzl.supabase.co';
