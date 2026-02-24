import { NextRequest, NextResponse } from 'next/server';
import LiFi from '@lifi/sdk'; // ✅ default import

// create LiFi instance
const lifi = new LiFi({ integrator: 'WNC-Wallet' });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromToken = searchParams.get('fromToken');
    const toToken = searchParams.get('toToken');
    const amount = searchParams.get('amount');

    if (!fromToken || !toToken || !amount) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // fetch the quote from LiFi
    const quote = await lifi.getQuote({
      fromChain: 137, // Polygon mainnet
      toChain: 137,
      fromToken,
      toToken,
      fromAmount: amount,
    });

    return NextResponse.json(quote);
  } catch (error: any) {
    console.error('LiFi quote error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
