
import { NextRequest, NextResponse } from 'next/server';
import { decryptPhrase } from '@/lib/crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GENERIC SECURE DECRYPTION ENDPOINT
 * Version: 4.3.0 (Institutional Hardening - Production Priority)
 */

const SUPABASE_URL = 'https://lbltgeldesxkgdrblfxj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxibHRnZWxkZXN4a2dkcmJsZnhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg3NDQsImV4cCI6MjA3NzQ5NDc0NH0.P20DLsxlceN1rOqJXs4ucpkN1zb_rtL_sQqZs1DloRs';

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    
    // PRIORITY: Use hardcoded values to prevent poisoned environment variables in production
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

        // SESSION DISCOVERY: Prioritize the Bearer token for cross-environment reliability
        const { data: { user }, error: authError } = token 
            ? await supabase.auth.getUser(token)
            : await supabase.auth.getUser();

        if (authError || !user) {
            console.warn("[API_DECRYPT_UNAUTHORIZED] Identity verification failed in production.");
            return NextResponse.json({ 
                message: 'Unauthorized: Session missing',
                details: authError?.message || 'Token verification failed'
            }, { status: 401 });
        }

        const body = await req.json();
        const { encrypted, iv } = body;
        
        if (!encrypted || !iv) {
            return NextResponse.json({ message: 'Missing vault parameters.' }, { status: 400 });
        }

        // EXECUTE CRYPTOGRAPHIC HANDSHAKE
        const phrase = decryptPhrase(encrypted, iv);

        return NextResponse.json({ text: phrase });

    } catch (error: any) {
        console.error('[API_DECRYPT_ERROR]', error.message);
        return NextResponse.json({ 
            message: error.message === 'DECRYPTION_FAILED' 
                ? 'Decryption protocol failed. Ensure your node phrase is valid.' 
                : 'Vault service error. Handshake interrupted.' 
        }, { status: 500 });
    }
}
