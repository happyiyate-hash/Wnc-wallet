import { createClient } from '@supabase/supabase-js';

/**
 * INSTITUTIONAL LOGO REGISTRY (SERVER-ONLY HARDCODED)
 * Project: lbltgeldesxkgdrblfxj
 * Uses Service Role Key for administrative metadata discovery.
 */

const LOGO_SUPABASE_URL = 'https://lbltgeldesxkgdrblfxj.supabase.co';
const LOGO_SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxibHRnZWxkZXN4a2dkcmJsZnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkxODc0NCwiZXhwIjoyMDc3NDk0NzQ0fQ.IVf5PGZER99nLARcgFTOQHe_6BGGUgo7XJM7hG7OCps';

export const logoSupabase = createClient(LOGO_SUPABASE_URL, LOGO_SUPABASE_SERVICE_ROLE, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
