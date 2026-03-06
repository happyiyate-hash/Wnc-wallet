import { NextResponse } from 'next/server'
import { getQuote } from '@lifi/sdk'
import { FEE_RECIPIENTS } from '@/lib/wallets/services/fee-recipients'

/**
 * LI.FI BRIDGE QUOTE API
 * Version: 2.0.0 (Institutional Monetization)
 * Includes 0.1% integrator fee routed to the central vault.
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

    // Handshake with LI.FI Aggregator
    const quote = await getQuote({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      slippage: slippage || 0.005,
      // INSTITUTIONAL REVENUE PARAMS
      integrator: 'wevina-terminal',
      fee: 0.001, // 0.1% (10 BPS)
    })

    return NextResponse.json(quote)

  } catch (error: any) {
    console.error('[LIFI_QUOTE_ERROR]', error)
    return NextResponse.json({
      error: 'Bridge Quote Failed',
      details: error.message
    }, { status: 500 })
  }
}
