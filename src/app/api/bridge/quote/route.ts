
import { NextRequest, NextResponse } from 'next/server';
import { LiFi } from '@lifi/sdk';

const lifi = new LiFi({
    integrator: 'WNC-Wallet',
});

/**
 * BRIDGE & SWAP QUOTE API
 * 
 * Fetches the best bridge/swap route from LI.FI based on the provided parameters.
 * Supports same-chain swaps and cross-chain bridging.
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

        if (!fromChain || !toChain || !fromToken || !toToken || !fromAmount || !fromAddress) {
            return NextResponse.json(
                { error: 'Missing required query parameters.' }, 
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
        };
        
        // Use the LI.FI SDK to find the best route
        const response = await lifi.getQuote(quoteRequest as any);
        
        return NextResponse.json(response);

    } catch (error: any) {
        console.error('[BRIDGE_QUOTE_ERROR]', error);
        
        const errorMessage = error.response?.data?.message || error.message || 'An internal server error occurred while fetching the bridge quote.';
        const status = error.response?.status || 500;
        
        return NextResponse.json(
            { error: 'Failed to fetch bridge quote.', details: errorMessage }, 
            { status }
        );
    }
}
