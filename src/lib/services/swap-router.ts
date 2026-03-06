'use client';

import { LIFI_SUPPORTED_CHAINS } from '../lifiSupportedChains';

/**
 * INSTITUTIONAL HYBRID SWAP ROUTER
 * Version: 5.0.0 (Centralized Decision Node)
 * 
 * Strictly enforces routing logic based on chain type:
 * 1. Same-Chain EVM -> 0x Protocol
 * 2. Cross-Chain EVM -> LI.FI API
 * 3. EVM ↔ Non-EVM or Unsupported -> Internal Liquidity Node (USDC Bridge)
 */

export type SwapProvider = 'ZEROX' | 'LIFI' | 'INTERNAL';

// Helper to detect EVM-compatible chains from our registry
const isEVM = (chainId: number) => {
    const nonEvm = [0, 144, 501, 1000, 2]; // BTC, XRP, SOL, DOT, KSM
    return !nonEvm.includes(chainId);
};

/**
 * Determines the best provider for a given swap route.
 * CENTRALIZED ROUTING NODE - No external components should decide provider logic.
 */
export function determineSwapProvider(
    fromChainId: number, 
    toChainId: number, 
    fromSymbol: string, 
    toSymbol: string
): SwapProvider {
    const fromEVM = isEVM(fromChainId);
    const toEVM = isEVM(toChainId);

    // Case 1: Same Chain (EVM only)
    if (fromChainId === toChainId && fromEVM) {
        return 'ZEROX';
    }

    // Case 2: Cross-EVM (Both EVM, different chains, within whitelist)
    const isFromLifiSupported = LIFI_SUPPORTED_CHAINS.includes(fromChainId);
    const isToLifiSupported = LIFI_SUPPORTED_CHAINS.includes(toChainId);
    
    if (fromChainId !== toChainId && fromEVM && toEVM && isFromLifiSupported && isToLifiSupported) {
        return 'LIFI';
    }

    // Case 3: EVM ↔ Non-EVM OR Same-Chain Non-EVM OR Unsupported Bridge
    // This utilizes the Internal Liquidity Node (The USDC/USDT Bridge)
    return 'INTERNAL';
}

/**
 * Detects if a route requires an intermediate USDC/USDT pivot.
 * Triggered for INTERNAL cross-chain handshakes where the user is not 
 * already swapping from/to a stable pivot node.
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
    
    // Direct Native Handshake Exemption (BNB -> BTC, ETH -> SOL etc)
    // These bypass the stable pivot if they are the primary chain assets
    if (fromIsNative && toIsNative && fromChainId !== toChainId) return false;

    // Same Chain doesn't need a cross-chain pivot
    if (fromChainId === toChainId) return false;

    // Check if either is already a stable pivot token (USDT/USDC)
    const isStable = (s: string) => ['USDT', 'USDC'].includes(s.toUpperCase());
    
    // If we're already swapping to/from a stable node, we don't need a pivot
    return !isStable(fromSymbol) && !isStable(toSymbol);
}

/**
 * Utility to describe the routing path for the UI.
 */
export function getRouteDescription(
    fromSymbol: string,
    toSymbol: string,
    provider: SwapProvider,
    isPivot: boolean
): string {
    if (provider === 'ZEROX') return `${fromSymbol} → ${toSymbol} (0x Liquidity)`;
    if (provider === 'LIFI') return `${fromSymbol} → ${toSymbol} (LI.FI Bridge)`;
    
    if (isPivot) {
        return `${fromSymbol} → USDC → USDC → ${toSymbol}`;
    }
    
    return `${fromSymbol} → ${toSymbol} (Internal Node)`;
}
