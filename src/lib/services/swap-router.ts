'use client';

import { LIFI_SUPPORTED_CHAINS } from '../lifiSupportedChains';

/**
 * INSTITUTIONAL HYBRID SWAP ROUTER
 * Version: 4.2.0 (Strict Aggregator Guard & Native Exemption)
 * 
 * Implements strict decision-making for swap fulfillment:
 * 1. Same-Chain EVM -> 0x API
 * 2. Cross-Chain EVM -> LI.FI API (Only if chains are in verified support list)
 * 3. Non-EVM, Internal, or Restricted EVM -> Internal Liquidity Engine
 */

export type SwapProvider = 'ZEROX' | 'LIFI' | 'INTERNAL';

const ZEROX_SUPPORTED_CHAINS = [1, 137, 56, 43114, 42161, 10, 8453, 59144, 534352];

/**
 * Determines the best provider for a given swap route.
 */
export function determineSwapProvider(
    fromChainId: number, 
    toChainId: number, 
    fromSymbol: string, 
    toSymbol: string
): SwapProvider {
    // 1. INTERNAL OVERRIDE (Whitelist & Logic Gate)
    const isFromNonEvm = fromChainId === 0 || fromChainId === 144 || fromChainId === 501 || fromChainId === 1000;
    const isToNonEvm = toChainId === 0 || toChainId === 144 || toChainId === 501 || toChainId === 1000;
    
    if (fromSymbol === 'WNC' || toSymbol === 'WNC' || isFromNonEvm || isToNonEvm) {
        return 'INTERNAL';
    }

    // 2. SAME-CHAIN EVM HANDSHAKE
    if (fromChainId === toChainId && ZEROX_SUPPORTED_CHAINS.includes(fromChainId)) {
        return 'ZEROX';
    }

    // 3. CROSS-CHAIN EVM HANDSHAKE (Strict LI.FI Guard)
    const isFromLifiSupported = LIFI_SUPPORTED_CHAINS.includes(fromChainId);
    const isToLifiSupported = LIFI_SUPPORTED_CHAINS.includes(toChainId);
    
    if (fromChainId !== toChainId && isFromLifiSupported && isToLifiSupported) {
        return 'LIFI';
    }

    // 4. FALLBACK: Internal Liquidity Node (For Non-EVM or unsupported EVM bridges)
    return 'INTERNAL';
}

/**
 * Detects if a route requires an intermediate USDT pivot.
 * Triggered for cross-chain internal handshakes.
 * EXEMPTION: Native-to-Native swaps bypass pivot.
 */
export function needsPivotRoute(
    fromChainId: number,
    toChainId: number,
    fromSymbol: string,
    toSymbol: string,
    provider: SwapProvider,
    fromIsNative: boolean = false,
    toIsNative: boolean = false
): boolean {
    if (provider !== 'INTERNAL') return false;
    
    const isCrossChain = fromChainId !== toChainId;
    if (!isCrossChain) return false;

    // DIRECT NATIVE EXEMPTION: Native-to-Native swaps across chains bypass USDT pivot node
    if (fromIsNative && toIsNative) return false;

    // Pivot required if neither token is the stable pivot node (USDT)
    const isFromPivot = fromSymbol.toUpperCase() === 'USDT';
    const isToPivot = toSymbol.toUpperCase() === 'USDT';

    return !isFromPivot || !isToPivot;
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
    return [provider];
}
