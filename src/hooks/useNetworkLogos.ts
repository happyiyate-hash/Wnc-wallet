'use client';

import { useState, useEffect } from 'react';
import type { ChainConfig } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import evmNetworks from '@/lib/evmNetworks.json';

const ALL_CHAINS_LIST: Omit<ChainConfig, 'iconUrl'>[] = Object.values(evmNetworks).map(n => ({ ...n, currencySymbol: n.symbol }));

/**
 * Hook to resolve network logos using public CDNs.
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

    return { chainsWithLogos, areLogosLoading };
}
