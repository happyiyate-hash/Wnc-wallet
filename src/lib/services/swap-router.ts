'use client';

/**
 * INSTITUTIONAL SWAP ROUTER
 * Version: 2.1.0 (Strict Routing Protocol)
 * Orchestrates liquidity discovery across 0x, LI.FI, and Internal nodes.
 */

export type SwapProvider = 'ZEROX' | 'LIFI' | 'INTERNAL';

const ZEROX_SUPPORTED_CHAINS = [1, 137, 56, 43114, 42161, 10, 8453, 59144, 534352];

/**
 * Determines the primary liquidity provider based on protocol rules.
 */
export function determineSwapProvider(fromChainId: number, toChainId: number, fromSymbol: string, toSymbol: string): SwapProvider {
  // 1. INTERNAL OVERRIDE: WNC or Non-EVM always routes through internal node
  if (fromSymbol === 'WNC' || toSymbol === 'WNC' || fromChainId === 0 || toChainId === 0) {
    return 'INTERNAL';
  }

  // 2. SAME-CHAIN EVM: Use 0x Aggregator for superior execution
  if (fromChainId === toChainId && ZEROX_SUPPORTED_CHAINS.includes(fromChainId)) {
    return 'ZEROX';
  }

  // 3. CROSS-CHAIN EVM: Use LI.FI for automated bridging
  if (fromChainId !== toChainId && fromChainId > 0 && toChainId > 0) {
    return 'LIFI';
  }

  return 'INTERNAL';
}

/**
 * Recommends valid candidates for market comparison.
 */
export function getRouteCandidates(fromChainId: number, toChainId: number, fromSymbol: string, toSymbol: string): SwapProvider[] {
    const candidates: SwapProvider[] = ['INTERNAL'];
    
    // Check Same-Chain Compatibility
    if (fromChainId === toChainId && fromChainId > 0) {
        if (ZEROX_SUPPORTED_CHAINS.includes(fromChainId)) {
            candidates.push('ZEROX');
        }
    }
    
    // Check Cross-Chain EVM Compatibility
    if (fromChainId !== toChainId && fromChainId > 0 && toChainId > 0) {
        candidates.push('LIFI');
    }
    
    return Array.from(new Set(candidates));
}
