import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption';

export async function POST(request: Request) {
  try {
    const { phrase } = await request.json();
    if (!phrase) return NextResponse.json({ error: 'Phrase is required' }, { status: 400 });

    const result = encrypt(phrase);
    return NextResponse.json({ 
      encrypted: result.encryptedData, 
      iv: result.iv 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
