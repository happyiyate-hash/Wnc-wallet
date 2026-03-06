
import { NextResponse } from 'next/server'
import { getQuote } from '@lifi/sdk'

/**
 * LI.FI BRIDGE QUOTE API
 * Version: 3.1.0 (Sustainability Update)
 * 
 * Increased revenue share to 0.30% (30 BPS).
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const fromChain = searchParams.get('fromChain')
    const toChain = searchParams.get('toChain')
    const fromToken = searchParams.get('fromToken')
    const toToken = searchParams.get('toToken')
    const fromAmount = searchParams.get('fromAmount')
    const fromAddress = searchParams.get('fromAddress')
    const slippage = searchParams.get('slippage')

    // PARAMETER GUARD: Ensure all required nodes are present
    if (!fromChain || !toChain || !fromToken || !toToken || !fromAmount || !fromAddress) {
      return NextResponse.json({ 
        error: 'Missing required bridge parameters',
        details: 'Handshake requires fromChain, toChain, tokens, amount and taker address.'
      }, { status: 400 })
    }

    // DISPATCH TO LI.FI AGGREGATOR
    const quote = await getQuote({
      fromChain: Number(fromChain),
      toChain: Number(toChain),
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      slippage: Number(slippage) || 0.005,
      // INSTITUTIONAL REVENUE PARAMS (30 BPS)
      integrator: 'wevina-terminal',
      fee: 0.003, 
    })

    return NextResponse.json(quote)

  } catch (error: any) {
    console.error('[LIFI_QUOTE_ERROR]', error.message || error)
    
    return NextResponse.json({
      error: 'Bridge Quote Failed',
      details: error.message || 'Liquidity route not found for this specific pair.'
    }, { status: 500 })
  }
}
