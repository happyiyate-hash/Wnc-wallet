'use client';

import { useState, useEffect } from 'react';
import type { ChainConfig } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import evmNetworks from '@/lib/evmNetworks.json';

const ALL_CHAINS_LIST: Omit<ChainConfig, 'iconUrl'>[] = Object.values(evmNetworks).map(n => ({ ...n, currencySymbol: n.symbol }));

/**
 * Hook to resolve network logos using public CDNs.
 * Since Supabase project might be paused, we rely on TrustWallet and Spothq GitHub assets.
 */
export function useNetworkLogos() {
    const [chainsWithLogos, setChainsWithLogos] = useState<ChainConfig[]>(ALL_CHAINS_LIST.map(c => ({...c, iconUrl: ''})));
    const [areLogosLoading, setAreLogosLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchLogos = async () => {
            setAreLogosLoading(true);
            try {
                const chainsWithFetchedLogos = await Promise.all(
                    ALL_CHAINS_LIST.map(async (chain) => {
                        // Use the new CDN-based logo fetcher
                        const logoUrl = await getTokenLogoUrl(chain.symbol, chain.name);
                        return {
                            ...chain,
                            iconUrl: logoUrl ?? undefined,
                        };
                    })
                );
                
                if (isMounted) {
                    setChainsWithLogos(chainsWithFetchedLogos);
                }
            } catch (error) {
                console.warn("Error resolving network logos, using fallbacks:", error);
                if (isMounted) {
                    setChainsWithLogos(ALL_CHAINS_LIST.map(c => ({...c, iconUrl: ''})));
                }
            } finally {
                if (isMounted) {
                    setAreLogosLoading(false);
                }
            }
        };

        fetchLogos();
        
        return () => {
            isMounted = false;
        };

    }, []);

    return { chainsWithLogos, areLogosLoading };
}
