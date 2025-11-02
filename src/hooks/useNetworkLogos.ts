'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ChainConfig } from '@/lib/types';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';

export function useNetworkLogos(initialChains: ChainConfig[]) {
    const [chainsWithLogos, setChainsWithLogos] = useState<ChainConfig[]>(initialChains);
    const [areLogosLoading, setAreLogosLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchLogos = async () => {
            setAreLogosLoading(true);
            try {
                const chainsWithFetchedLogos = await Promise.all(
                    initialChains.map(async (chain) => {
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
                    setChainsWithLogos(initialChains);
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

    }, [initialChains]);

    return { chainsWithLogos, areLogosLoading };
}
