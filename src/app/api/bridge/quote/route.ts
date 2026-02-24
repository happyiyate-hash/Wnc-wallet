import { NextRequest, NextResponse } from 'next/server';
import LiFi from '@lifi/sdk';

// create LiFi instance with integrator identification
const lifi = new LiFi({ integrator: 'WNC-Wallet' });

/**
 * BRIDGE & SWAP QUOTE API
 * 
 * Uses the default LiFi import and instance method to resolve build errors.
 * Dynamically handles chains, tokens, and amounts from URL parameters.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        
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
                { error: 'Missing required parameters for bridge quote.' }, 
                { status: 400 }
            );
        }

        // Fetch the quote from the LiFi instance
        const quote = await lifi.getQuote({
            fromChain: Number(fromChain),
            toChain: Number(toChain),
            fromToken,
            toToken,
            fromAmount,
            fromAddress,
            toAddress: toAddress || fromAddress,
            slippage: Number(slippage),
        });
        
        return NextResponse.json(quote);

    } catch (error: any) {
        console.error('[LI.FI_QUOTE_ERROR]', error);
        return NextResponse.json(
            { error: 'Bridge Service Error', details: error.message || 'Unknown error' }, 
            { status: 500 }
        );
    }
}
