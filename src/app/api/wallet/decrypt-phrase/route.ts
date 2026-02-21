import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption';

export async function POST(request: Request) {
  try {
    const { encrypted, iv } = await request.json();
    if (!encrypted || !iv) return NextResponse.json({ error: 'Encrypted data and IV are required' }, { status: 400 });

    const phrase = decrypt(encrypted, iv);
    return NextResponse.json({ phrase });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
