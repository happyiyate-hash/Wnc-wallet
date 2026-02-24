
import { NextRequest, NextResponse } from 'next/server';
import { getQuote, createConfig } from '@lifi/sdk';

// Configure LI.FI SDK globally
createConfig({
    integrator: 'WNC-Wallet',
});

/**
 * BRIDGE & SWAP QUOTE API (LI.FI SDK v3)
 * 
 * Fetches the best bridge/swap route using functional API approach.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;

    try {
        const fromChain = searchParams.get('fromChain');
        const toChain = searchParams.get('toChain');
        const fromToken = searchParams.get('fromToken');
        const toToken = searchParams.get('toToken');
        const fromAmount = searchParams.get('fromAmount');
        const fromAddress = searchParams.get('fromAddress');
        const toAddress = searchParams.get('toAddress');
        const slippage = searchParams.get('slippage') || '0.005';

        if (!fromChain || !toChain || !fromToken || !toToken || !fromAmount || !fromAddress) {
            return NextResponse.json(
                { error: 'Missing required parameters for LI.FI quote.' }, 
                { status: 400 }
            );
        }

        const quoteRequest = {
            fromChain: Number(fromChain),
            toChain: Number(toChain),
            fromToken,
            toToken,
            fromAmount,
            fromAddress,
            toAddress: toAddress || fromAddress,
            slippage: Number(slippage),
        };
        
        // In v3, use the getQuote function directly
        const response = await getQuote(quoteRequest as any);
        
        return NextResponse.json(response);

    } catch (error: any) {
        console.error('[LI.FI_QUOTE_ERROR]', error);
        
        const errorMessage = error.message || 'DEX aggregation failed. Please try a different asset pair.';
        
        return NextResponse.json(
            { error: 'DEX Aggregator Error', details: errorMessage }, 
            { status: 500 }
        );
    }
}
