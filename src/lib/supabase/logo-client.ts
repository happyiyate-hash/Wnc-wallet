
'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * DEDICATED LOGO & METADATA SUPABASE CLIENT
 * 
 * Used strictly for fetching token logos and network metadata.
 */

const logoSupabaseUrl = process.env.NEXT_PUBLIC_LOGO_SUPABASE_URL || 'https://gcghriodmljkusdduhzl.supabase.co';
const logoSupabaseAnonKey = process.env.NEXT_PUBLIC_LOGO_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZ2hyaW9kbWxqa3VzZGR1aHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzkzMTQsImV4cCI6MjA4NzUxNTMxNH0.TltNWXGtBsRm1VdJ5idiTji863BiKKOD54Q40iXRJy8';

export const logoSupabase = logoSupabaseUrl && logoSupabaseAnonKey 
  ? createClient(logoSupabaseUrl, logoSupabaseAnonKey)
  : null;
