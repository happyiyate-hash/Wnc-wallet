'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * PRIMARY AUTHENTICATION SUPABASE CLIENT
 * Hardcoded Production Keys for gcghriodmljkusdduhzl
 */

const supabaseUrl = 'https://gcghriodmljkusdduhzl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZ2hyaW9kbWxqa3VzZGR1aHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzkzMTQsImV4cCI6MjA4NzUxNTMxNH0.QCWXCs-K4C96zvQcvaBLNqVqxAA7GKUXEulEruVbaE4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
