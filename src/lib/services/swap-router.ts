
'use client';

/**
 * INSTITUTIONAL SWAP ROUTER
 * Version: 2.0.0 (Smart Routing Protocol)
 * Decides between internal liquidity, 0x aggregator, and cross-chain bridges.
 */

export type SwapProvider = 'ZEROX' | 'LIFI' | 'INTERNAL';

const ZEROX_SUPPORTED_CHAINS = [1, 137, 56, 43114, 42161, 10, 8453, 59144, 534352];

export function determineSwapProvider(fromChainId: number, toChainId: number, fromSymbol: string, toSymbol: string): SwapProvider {
  // 1. INTERNAL OVERRIDE: WNC swaps always go through internal liquidity
  if (fromSymbol === 'WNC' || toSymbol === 'WNC') {
    return 'INTERNAL';
  }

  // 2. SAME-CHAIN EVM: Use 0x Aggregator for superior same-chain pricing
  if (fromChainId === toChainId && ZEROX_SUPPORTED_CHAINS.includes(fromChainId)) {
    return 'ZEROX';
  }

  // 3. CROSS-CHAIN EVM: Use LI.FI Bridge for automated interoperability
  if (fromChainId !== toChainId && fromChainId > 0 && toChainId > 0) {
    return 'LIFI';
  }

  // 4. FALLBACK: Internal Liquidity Node
  return 'INTERNAL';
}

/**
 * Recommends multiple routes for comparison.
 */
export function getRouteCandidates(fromChainId: number, toChainId: number, fromSymbol: string, toSymbol: string): SwapProvider[] {
    const candidates: SwapProvider[] = ['INTERNAL']; // Internal node is always a candidate
    
    if (fromChainId === toChainId && ZEROX_SUPPORTED_CHAINS.includes(fromChainId)) {
        candidates.push('ZEROX');
    }
    
    if (fromChainId !== 0 && toChainId !== 0) {
        candidates.push('LIFI');
    }
    
    return Array.from(new Set(candidates));
}
