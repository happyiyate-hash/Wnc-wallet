
import { NextRequest, NextResponse } from 'next/server';
import LiFi from '@lifi/sdk';

/**
 * LI.FI BRIDGE QUOTE API
 * Fetches dynamic cross-chain quotes based on parameters.
 */

const lifi = new LiFi({ integrator: 'WNC-Wallet' });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromChain = searchParams.get('fromChain');
    const toChain = searchParams.get('toChain');
    const fromToken = searchParams.get('fromToken');
    const toToken = searchParams.get('toToken');
    const fromAmount = searchParams.get('fromAmount');
    const fromAddress = searchParams.get('fromAddress');
    const slippage = searchParams.get('slippage');

    if (!fromToken || !toToken || !fromAmount || !fromChain || !toChain) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const quote = await lifi.getQuote({
      fromChain: parseInt(fromChain),
      toChain: parseInt(toChain),
      fromToken,
      toToken,
      fromAmount,
      fromAddress: fromAddress || undefined,
      slippage: slippage ? parseFloat(slippage) : undefined,
    });

    return NextResponse.json(quote);
  } catch (error: any) {
    console.error('LiFi quote error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
