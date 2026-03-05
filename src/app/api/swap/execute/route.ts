
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { swapExecutionService } from '@/lib/services/swap-execution-service';

/**
 * INSTITUTIONAL SWAP HANDSHAKE API
 * Version: 1.1.0
 * 
 * Secure entry point for initiating a liquidity-provided swap.
 * Returns the Admin Deposit address for the user leg.
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
      fromTokenPriceUsd,
      toAmountExpected,
      adminFeeUsd,
      networkFeeUsd,
      recipientAddress
    } = body;

    // VALIDATION NODE
    if (!fromChain || !toChain || !fromAmount) {
      return NextResponse.json({ error: 'Incomplete swap parameters' }, { status: 400 });
    }

    // Call the institutional execution service to lock the registry node
    const handshake = await swapExecutionService.initiateSwap({
      userId: user.id,
      fromChain,
      toChain,
      fromSymbol,
      toSymbol,
      fromAmount,
      fromTokenPriceUsd,
      toAmountExpected,
      adminFeeUsd,
      networkFeeUsd,
      recipientAddress
    });

    return NextResponse.json({ 
      success: true, 
      swapId: handshake.swapId,
      adminAddress: handshake.adminAddress,
      message: 'Registry node locked. Proceed to deposit.'
    });

  } catch (error: any) {
    console.error('[API_SWAP_EXECUTE_ERROR]', error.message);
    return NextResponse.json({ error: error.message || 'Internal swap failure' }, { status: 500 });
  }
}
