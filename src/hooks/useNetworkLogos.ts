'use client';

import { useState, useEffect } from 'react';
import type { ChainConfig } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import { ALL_CHAINS_LIST } from '@/lib/user-networks';

export function useNetworkLogos() {
    const [chainsWithLogos, setChainsWithLogos] = useState<ChainConfig[]>(ALL_CHAINS_LIST);
    const [areLogosLoading, setAreLogosLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchLogos = async () => {
            setAreLogosLoading(true);
            try {
                const chainsWithFetchedLogos = await Promise.all(
                    ALL_CHAINS_LIST.map(async (chain) => {
                        // For networks, the most reliable symbol is often their native currency symbol.
                        const logoUrl = await getTokenLogoUrl(chain.currencySymbol, chain.name);
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
                console.error("Failed to fetch network logos:", error);
                if (isMounted) {
                    // On error, proceed with the initial list (which has empty iconUrl strings)
                    setChainsWithLogos(ALL_CHAINS_LIST);
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

    }, []); // Empty dependency array ensures this runs only once.

    return { chainsWithLogos, areLogosLoading };
}
