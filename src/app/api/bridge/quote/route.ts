import { NextResponse } from 'next/server'
import { getQuote } from '@lifi/sdk'

/**
 * LI.FI BRIDGE QUOTE API (V3 SDK)
 * Uses the functional getQuote method to resolve compilation failures.
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const fromChain = Number(searchParams.get('fromChain'))
    const toChain = Number(searchParams.get('toChain'))
    const fromToken = searchParams.get('fromToken')!
    const toToken = searchParams.get('toToken')!
    const fromAmount = searchParams.get('fromAmount')!
    const fromAddress = searchParams.get('fromAddress')!
    const slippage = Number(searchParams.get('slippage'))

    // Functional API for LI.FI v3.x
    const quote = await getQuote({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      slippage: slippage || 0.005, // Default 0.5% if not provided
    })

    return NextResponse.json(quote)

  } catch (error: any) {
    console.error('[LIFI_QUOTE_ERROR]', error)

    return NextResponse.json({
      error: 'Quote failed',
      details: error.message
    }, { status: 500 })
  }
}
