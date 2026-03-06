
import { NextRequest, NextResponse } from 'next/server';
import { encryptPhrase } from '@/lib/crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GENERIC SECURE ENCRYPTION ENDPOINT
 * Version: 4.3.0 (Institutional Hardening - Production Priority)
 */

const SUPABASE_URL = 'https://lbltgeldesxkgdrblfxj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxibHRnZWxkZXN4a2dkcmJsZnhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg3NDQsImV4cCI6MjA3NzQ5NDc0NH0.P20DLsxlceN1rOqJXs4ucpkN1zb_rtL_sQqZs1DloRs';

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          cookies: {
            get(name: string) { return cookieStore.get(name)?.value },
            set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }) },
            remove(name: string, options: any) { cookieStore.set({ name, value: '', ...options }) },
          },
        }
    );

    try {
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];

        const { data: { user }, error: authError } = token 
            ? await supabase.auth.getUser(token)
            : await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ message: 'Unauthorized: Session missing' }, { status: 401 });
        }

        const body = await req.json();
        const payload = body.text || body.phrase;

        if (!payload || typeof payload !== 'string') {
            return NextResponse.json({ message: 'Plaintext string required.' }, { status: 400 });
        }

        const { encrypted, iv } = encryptPhrase(payload);

        return NextResponse.json({ encrypted, iv });

    } catch (error: any) {
        console.error('[API_ENCRYPT_ERROR]', error.message);
        return NextResponse.json({ message: 'Encryption protocol failed.' }, { status: 500 });
    }
}
