
'use client';

import { LIFI_SUPPORTED_CHAINS } from '../lifiSupportedChains';

/**
 * INSTITUTIONAL HYBRID SWAP ROUTER
 * Version: 7.0.0 (TRON Protocol Integration)
 * 
 * Strictly enforces routing logic based on chain type:
 * 1. Same-Chain EVM -> 0x Protocol
 * 2. Cross-EVM -> LI.FI API
 * 3. Solana -> Jupiter API
 * 4. TRON -> TRC20 Engine
 * 5. Hybrid/Non-EVM -> Sync Node (Multi-Step Pivot Bridge)
 */

export type SwapProvider = 'ZEROX' | 'LIFI' | 'INTERNAL' | 'SOLANA' | 'TRON';

const isEVM = (chainId: number) => {
    const nonEvm = [0, 144, 501, 1000, 2, 728126428]; // BTC, XRP, SOL, DOT, KSM, TRON
    return !nonEvm.includes(chainId);
};

export function determineSwapProvider(
    fromChainId: number, 
    toChainId: number, 
    fromSymbol: string, 
    toSymbol: string
): SwapProvider {
    // 1. Solana Native -> Jupiter Optimization
    if (fromChainId === 501 && toChainId === 501) {
        return 'SOLANA';
    }

    // 2. TRON Native/TRC20 -> SunSwap Optimization
    if (fromChainId === 728126428 && toChainId === 728126428) {
        return 'TRON';
    }

    const fromEVM = isEVM(fromChainId);
    const toEVM = isEVM(toChainId);

    // 3. Same Chain EVM -> High speed 0x
    if (fromChainId === toChainId && fromEVM) {
        return 'ZEROX';
    }

    // 4. Cross-EVM -> LI.FI Aggregator
    const isFromLifiSupported = LIFI_SUPPORTED_CHAINS.includes(fromChainId);
    const isToLifiSupported = LIFI_SUPPORTED_CHAINS.includes(toChainId);
    
    if (fromChainId !== toChainId && fromEVM && toEVM && isFromLifiSupported && isToLifiSupported) {
        return 'LIFI';
    }

    // 5. All other routes (SOL, BTC, XRP, etc) -> Internal Liquidity Node
    return 'INTERNAL';
}

/**
 * Detects if a "Pivot Route" is required.
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
    
    if (fromChainId === toChainId) return false;
    if (fromIsNative && toIsNative) return false;

    const isStable = (s: string) => ['USDT', 'USDC'].includes(s.toUpperCase());
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
    if (isPivot) return `${fromSymbol}→USDC→${toSymbol}`;
    return `${fromSymbol}→${toSymbol} (Sync)`;
}
