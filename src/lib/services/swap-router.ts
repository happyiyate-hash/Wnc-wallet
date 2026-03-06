
'use client';

/**
 * INSTITUTIONAL HYBRID SWAP ROUTER
 * Version: 3.0.0 (Tiered Liquidity Protocol)
 * 
 * Implements strict decision-making for swap fulfillment:
 * 1. Same-Chain EVM -> 0x API
 * 2. Cross-Chain EVM -> LI.FI API
 * 3. Non-EVM or Internal -> Custom Liquidity Engine
 */

export type SwapProvider = 'ZEROX' | 'LIFI' | 'INTERNAL';

const ZEROX_SUPPORTED_CHAINS = [1, 137, 56, 43114, 42161, 10, 8453, 59144, 534352];

export function determineSwapProvider(
    fromChainId: number, 
    toChainId: number, 
    fromSymbol: string, 
    toSymbol: string
): SwapProvider {
    // 1. INTERNAL OVERRIDE (Whitelist & Logic Gate)
    // Non-EVM chains (chainId 0, 144, 501, etc.) or Internal WNC always route to internal provider
    const isFromNonEvm = fromChainId === 0 || fromChainId === 144 || fromChainId === 501 || fromChainId === 1000;
    const isToNonEvm = toChainId === 0 || toChainId === 144 || toChainId === 501 || toChainId === 1000;
    
    if (fromSymbol === 'WNC' || toSymbol === 'WNC' || isFromNonEvm || isToNonEvm) {
        return 'INTERNAL';
    }

    // 2. SAME-CHAIN EVM HANDSHAKE
    if (fromChainId === toChainId && ZEROX_SUPPORTED_CHAINS.includes(fromChainId)) {
        return 'ZEROX';
    }

    // 3. CROSS-CHAIN EVM HANDSHAKE
    // If both are EVM but different chains, use LI.FI bridge aggregator
    const isFromEvm = !isFromNonEvm;
    const isToEvm = !isToNonEvm;
    
    if (isFromEvm && isToEvm && fromChainId !== toChainId) {
        return 'LIFI';
    }

    // FALLBACK
    return 'INTERNAL';
}

/**
 * Returns all valid routing candidates for comparison.
 */
export function getRouteCandidates(
    fromChainId: number, 
    toChainId: number, 
    fromSymbol: string, 
    toSymbol: string
): SwapProvider[] {
    const provider = determineSwapProvider(fromChainId, toChainId, fromSymbol, toSymbol);
    
    // In this hybrid model, we strictly return the single best engine candidate 
    // to prevent liquidity leakage and ensure fee capture.
    return [provider];
}
