
import { NextRequest, NextResponse } from 'next/server';
import { decryptPhrase } from '@/lib/crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
        // Ensure user is authenticated before allowing decryption
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { encrypted, iv } = await req.json();
        if (!encrypted || !iv) {
            return NextResponse.json({ message: 'Encrypted phrase and IV are required.' }, { status: 400 });
        }

        // The `decryptPhrase` function is now a server-only function
        const phrase = decryptPhrase(encrypted, iv);

        return NextResponse.json({ phrase });

    } catch (error: any) {
        console.error('[API_DECRYPT_ERROR]', error);
        // Do not leak specific crypto errors to the client
        return NextResponse.json({ message: 'Decryption failed on the server.' }, { status: 500 });
    }
}
