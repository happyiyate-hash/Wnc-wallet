'use client';

import { LIFI_SUPPORTED_CHAINS } from '../lifiSupportedChains';

/**
 * INSTITUTIONAL HYBRID SWAP ROUTER
 * Version: 9.0.0 (Automatic Decision Engine)
 * 
 * Formalized mapping based on institutional selection protocol:
 * 1. Same-Chain EVM -> 0x Protocol
 * 2. Cross-EVM -> LI.FI API
 * 3. Solana -> Jupiter API
 * 4. TRON -> TRC20 Engine (SunSwap)
 * 5. Hybrid/Non-EVM/Other -> Internal Liquidity Node (Automatic Pivot)
 */

export type SwapProvider = 'ZEROX' | 'LIFI' | 'INTERNAL' | 'SOLANA' | 'TRON';

const isEVM = (chainId: number) => {
    const nonEvm = [0, 144, 501, 1000, 2, 728126428]; // BTC, XRP, SOL, DOT, KSM, TRON
    return !nonEvm.includes(chainId);
};

/**
 * AUTOMATIC SWAP DECISION NODE
 * Resolves the correct engine based on the token selection.
 */
export function determineSwapProvider(
    fromChainId: number, 
    toChainId: number, 
    fromSymbol: string, 
    toSymbol: string
): SwapProvider {
    // 1. Solana (SPL) -> Jupiter Optimization
    if (fromChainId === 501 && toChainId === 501) {
        return 'SOLANA';
    }

    // 2. TRON (TRC20) -> SunSwap Optimization
    if (fromChainId === 728126428 && toChainId === 728126428) {
        return 'TRON';
    }

    const fromEVM = isEVM(fromChainId);
    const toEVM = isEVM(toChainId);

    // 3. Same Chain EVM -> 0x Protocol
    if (fromChainId === toChainId && fromEVM) {
        return 'ZEROX';
    }

    // 4. Cross-EVM -> LI.FI Aggregator
    const isFromLifiSupported = LIFI_SUPPORTED_CHAINS.includes(fromChainId);
    const isToLifiSupported = LIFI_SUPPORTED_CHAINS.includes(toChainId);
    
    if (fromChainId !== toChainId && fromEVM && toEVM && isFromLifiSupported && isToLifiSupported) {
        return 'LIFI';
    }

    // 5. Hybrid / Non-EVM / Other -> Internal Liquidity Provider
    return 'INTERNAL';
}

/**
 * PIVOT ROUTE DETECTOR
 * Enforces USDT/USDC stabilization for volatile or hybrid pairs.
 */
export function needsPivotRoute(
    fromChainId: number,
    toChainId: number,
    fromSymbol: string,
    toSymbol: string,
    provider: SwapProvider
): boolean {
    if (provider !== 'INTERNAL') return false;
    
    // Always pivot if bridging between different chains via internal node
    if (fromChainId !== toChainId) return true;

    // Pivot if swapping between two volatile assets on the same non-standard chain
    const isStable = (s: string) => ['USDT', 'USDC', 'DAI'].includes(s.toUpperCase());
    return !isStable(fromSymbol) && !isStable(toSymbol);
}

export function getRouteDescription(
    fromSymbol: string,
    toSymbol: string,
    provider: SwapProvider,
    isPivot: boolean
): string {
    if (provider === 'ZEROX') return `${fromSymbol}→${toSymbol} (0x)`;
    if (provider === 'LIFI') return `${fromSymbol}→${toSymbol} (Bridge)`;
    if (provider === 'SOLANA') return `${fromSymbol}→${toSymbol} (Jupiter)`;
    if (provider === 'TRON') return `${fromSymbol}→${toSymbol} (SunSwap)`;
    if (isPivot) return `${fromSymbol}→USDT→${toSymbol}`;
    return `${fromSymbol}→${toSymbol} (Sync)`;
}
