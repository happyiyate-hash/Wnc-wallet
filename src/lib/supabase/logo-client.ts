
'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * DEDICATED LOGO & METADATA SUPABASE CLIENT (gcghriodmljkusdduhzl)
 * This is the ONLY client used for fetching token branding and network registries.
 */

const logoSupabaseUrl = 'https://gcghriodmljkusdduhzl.supabase.co';
const logoSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZ2hyaW9kbWxqa3VzZGR1aHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzkzMTQsImV4cCI6MjA4NzUxNTMxNH0.TltNWXGtBsRm1VdJ5idiTji863BiKKOD54Q40iXRJy8';

export const logoSupabase = createClient(logoSupabaseUrl, logoSupabaseAnonKey);
