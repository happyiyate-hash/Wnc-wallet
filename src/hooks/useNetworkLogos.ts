'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ChainConfig } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import evmNetworks from '@/lib/evmNetworks.json';

const ALL_CHAINS_LIST: Omit<ChainConfig, 'iconUrl'>[] = Object.values(evmNetworks).map(n => ({ ...n, currencySymbol: n.symbol }));

/**
 * Hook to resolve network logos and provide a high-performance indexed registry.
 */
export function useNetworkLogos() {
    const [chainsWithLogos, setChainsWithLogos] = useState<ChainConfig[]>(ALL_CHAINS_LIST.map(c => ({...c, iconUrl: ''})));
    const [areLogosLoading, setAreLogosLoading] = useState(true);

    useEffect(() => {
        const chainsWithFetchedLogos = ALL_CHAINS_LIST.map((chain) => {
            const logoUrl = getTokenLogoUrl(chain.symbol, chain.name);
            return {
                ...chain,
                iconUrl: logoUrl ?? undefined,
            };
        });
        
        setChainsWithLogos(chainsWithFetchedLogos);
        setAreLogosLoading(false);
    }, []);

    // Create a high-performance ID-to-Chain mapping
    const allChainsMap = useMemo(() => {
        return chainsWithLogos.reduce((acc, chain) => {
            acc[chain.chainId] = chain;
            return acc;
        }, {} as { [key: number]: ChainConfig });
    }, [chainsWithLogos]);

    return { chainsWithLogos, areLogosLoading, allChainsMap };
}
