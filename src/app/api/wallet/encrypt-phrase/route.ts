import { NextRequest, NextResponse } from 'next/server';
import { encryptPhrase } from '@/lib/crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * SECURE ENCRYPTION ENDPOINT
 * 
 * Next.js 15 Compatibility: Uses awaited cookies and authenticated session validation.
 */

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

        const { data: { user } } = token 
            ? await supabase.auth.getUser(token)
            : await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ message: 'Unauthorized: Session missing' }, { status: 401 });
        }

        const { phrase } = await req.json();
        if (!phrase) {
            return NextResponse.json({ message: 'Plaintext phrase required.' }, { status: 400 });
        }

        // Canonical encryption
        const { encrypted, iv } = encryptPhrase(phrase);

        return NextResponse.json({ encrypted, iv });

    } catch (error: any) {
        console.error('[API_ENCRYPT_ERROR]', error.message);
        return NextResponse.json({ message: 'Encryption failed.' }, { status: 500 });
    }
}
