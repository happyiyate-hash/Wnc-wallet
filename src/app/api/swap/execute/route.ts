
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * INSTITUTIONAL SWAP HANDSHAKE API
 * Version: 1.0.0
 * 
 * Secure entry point for initiating a liquidity-provided swap.
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

    const body = await req.json();
    const { 
      fromChain, 
      toChain, 
      fromSymbol, 
      toSymbol, 
      fromAmount, 
      toAmountExpected,
      adminFeeUsd,
      networkFeeUsd
    } = body;

    // VALIDATION NODE
    if (!fromChain || !toChain || !fromAmount) {
      return NextResponse.json({ error: 'Incomplete swap parameters' }, { status: 400 });
    }

    // In a real implementation, we would call the swapExecutionService.initiateSwap here
    // But since that service is 'use client', we perform the DB insert directly via the server client
    const { data, error } = await supabase
      .from('swaps')
      .insert({
        user_id: user.id,
        from_chain: fromChain,
        to_chain: toChain,
        from_symbol: fromSymbol,
        to_symbol: toSymbol,
        from_amount: fromAmount,
        to_amount_expected: toAmountExpected,
        admin_fee_usd: adminFeeUsd,
        network_fee_usd: networkFeeUsd,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      swapId: data.id,
      message: 'Swap handshake initiated. Proceed to deposit.'
    });

  } catch (error: any) {
    console.error('[API_SWAP_EXECUTE_ERROR]', error.message);
    return NextResponse.json({ error: 'Internal swap failure' }, { status: 500 });
  }
}
