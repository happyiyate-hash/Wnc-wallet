
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { swapExecutionService } from '@/lib/services/swap-execution-service';

/**
 * INSTITUTIONAL SWAP FINALIZER API
 * Triggered after the first leg (User -> Admin) is confirmed.
 * Orchestrates the Admin -> User settlement leg.
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const { swapId, txHash } = await req.json();

    if (!swapId || !txHash) {
      return NextResponse.json({ error: 'Missing settlement parameters' }, { status: 400 });
    }

    // Trigger institutional settlement (Leg 2)
    const adminTxHash = await swapExecutionService.finalizeAndSettle(swapId, txHash);

    return NextResponse.json({ 
      success: true, 
      adminTxHash,
      message: 'Settlement authorized. Payout dispatched.'
    });

  } catch (error: any) {
    console.error('[API_SWAP_FINALIZE_ERROR]', error.message);
    return NextResponse.json({ error: error.message || 'Settlement failure' }, { status: 500 });
  }
}
