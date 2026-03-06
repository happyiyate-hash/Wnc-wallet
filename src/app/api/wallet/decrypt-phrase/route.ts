import { NextRequest, NextResponse } from 'next/server';
import { decryptPhrase } from '@/lib/crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GENERIC SECURE DECRYPTION ENDPOINT
 * Returns: { "text": "..." } as per SmarterSeller Standard.
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

        const { encrypted, iv } = await req.json();
        if (!encrypted || !iv) {
            return NextResponse.json({ message: 'Missing vault parameters.' }, { status: 400 });
        }

        const phrase = decryptPhrase(encrypted, iv);

        // Standardized SmarterSeller return key
        return NextResponse.json({ text: phrase });

    } catch (error: any) {
        console.error('[API_DECRYPT_ERROR]', error.message);
        return NextResponse.json({ message: 'Decryption failed.' }, { status: 500 });
    }
}
