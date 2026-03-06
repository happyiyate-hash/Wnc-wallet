
'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * PRIMARY AUTHENTICATION & PROFILE REGISTRY (HARDCODED PRODUCTION)
 * Project: lbltgeldesxkgdrblfxj
 */

const supabaseUrl = 'https://lbltgeldesxkgdrblfxj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxibHRnZWxkZXN4a2dkcmJsZnhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg3NDQsImV4cCI6MjA3NzQ5NDc0NH0.P20DLsxlceN1rOqJXs4ucpkN1zb_rtL_sQqZs1DloRs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
