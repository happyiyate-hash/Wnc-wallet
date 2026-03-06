'use client';

import { LIFI_SUPPORTED_CHAINS } from '../lifiSupportedChains';

/**
 * INSTITUTIONAL HYBRID SWAP ROUTER
 * Version: 6.0.0 (Pivot Logic Update)
 * 
 * Strictly enforces routing logic based on chain type:
 * 1. Same-Chain EVM -> 0x Protocol
 * 2. Cross-EVM -> LI.FI API
 * 3. Hybrid/Non-EVM -> Sync Node (Multi-Step Pivot Bridge)
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

    // 1. Same Chain EVM -> High speed 0x
    if (fromChainId === toChainId && fromEVM) {
        return 'ZEROX';
    }

    // 2. Cross-EVM -> LI.FI Aggregator
    const isFromLifiSupported = LIFI_SUPPORTED_CHAINS.includes(fromChainId);
    const isToLifiSupported = LIFI_SUPPORTED_CHAINS.includes(toChainId);
    
    if (fromChainId !== toChainId && fromEVM && toEVM && isFromLifiSupported && isToLifiSupported) {
        return 'LIFI';
    }

    // 3. All other routes (SOL, BTC, XRP, etc) -> Internal Liquidity Node
    return 'INTERNAL';
}

/**
 * Detects if a "Pivot Route" is required.
 * A pivot is needed if the transfer is cross-chain and neither asset is a stablecoin (USDC/USDT).
 * Path: Token A -> USDC (Source) -> USDC (Dest) -> Token B
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
    
    // Internal swaps on same chain or simple native-to-native don't need pivot
    if (fromChainId === toChainId) return false;
    if (fromIsNative && toIsNative) return false;

    const isStable = (s: string) => ['USDT', 'USDC'].includes(s.toUpperCase());
    
    // If we are cross-chain and moving between non-stables, pivot is mandatory for liquidity
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
