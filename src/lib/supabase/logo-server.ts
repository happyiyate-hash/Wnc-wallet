import { createClient } from '@supabase/supabase-js';

/**
 * INSTITUTIONAL LOGO REGISTRY (SERVER-ONLY)
 * Hardcoded Production Keys for gcghriodmljkusdduhzl
 */

const LOGO_SUPABASE_URL = 'https://gcghriodmljkusdduhzl.supabase.co';
const LOGO_SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZ2hyaW9kbWxqa3VzZGR1aHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzkzMTQsImV4cCI6MjA4NzUxNTMxNH0.QCWXCs-K4C96zvQcvaBLNqVqxAA7GKUXEulEruVbaE4';

export const logoSupabase = createClient(LOGO_SUPABASE_URL, LOGO_SUPABASE_SERVICE_ROLE, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
