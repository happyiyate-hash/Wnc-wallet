'use client';

import { LIFI_SUPPORTED_CHAINS } from '../lifiSupportedChains';

/**
 * INSTITUTIONAL HYBRID SWAP ROUTER
 * Version: 5.1.0 (Concise Node Naming)
 * 
 * Strictly enforces routing logic based on chain type:
 * 1. Same-Chain EVM -> 0x Protocol
 * 2. Cross-EVM -> LI.FI API
 * 3. Hybrid/Non-EVM -> Sync Node (USDC Bridge)
 */

export type SwapProvider = 'ZEROX' | 'LIFI' | 'INTERNAL';

const isEVM = (chainId: number) => {
    const nonEvm = [0, 144, 501, 1000, 2]; // BTC, XRP, SOL, DOT, KSM
    return !nonEvm.includes(chainId);
};

export function determineSwapProvider(
    fromChainId: number, 
    toChainId: number, 
    fromSymbol: string, 
    toSymbol: string
): SwapProvider {
    const fromEVM = isEVM(fromChainId);
    const toEVM = isEVM(toChainId);

    if (fromChainId === toChainId && fromEVM) {
        return 'ZEROX';
    }

    const isFromLifiSupported = LIFI_SUPPORTED_CHAINS.includes(fromChainId);
    const isToLifiSupported = LIFI_SUPPORTED_CHAINS.includes(toChainId);
    
    if (fromChainId !== toChainId && fromEVM && toEVM && isFromLifiSupported && isToLifiSupported) {
        return 'LIFI';
    }

    return 'INTERNAL';
}

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
    if (fromIsNative && toIsNative && fromChainId !== toChainId) return false;
    if (fromChainId === toChainId) return false;

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
    if (isPivot) return `${fromSymbol}→USDC→${toSymbol}`;
    return `${fromSymbol}→${toSymbol} (Sync)`;
}
