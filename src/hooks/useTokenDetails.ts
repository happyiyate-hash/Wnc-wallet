'use client';

import { useState, useEffect } from 'react';
import { fetchSingleTokenDetails } from '@/lib/coingecko';
import { useWallet } from '@/contexts/wallet-provider';

/**
 * Hook to fetch market metadata for a specific token.
 * Optimized for "Silent Refresh" to prevent UI skeletons during background updates.
 */
export function useSingleTokenDetails(coingeckoId: string | null | undefined) {
    const { allAssets } = useWallet();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!coingeckoId) {
            setData(null);
            return;
        };

        const fetchDetails = async () => {
            if (!data) setIsLoading(true);
            setError(null);
            try {
                let currentPrice = 0;
                if (coingeckoId === 'internal:wnc') {
                    const wnc = allAssets.find(a => a.symbol === 'WNC');
                    currentPrice = wnc?.priceUsd || 0.000606;
                }
                const result = await fetchSingleTokenDetails(coingeckoId, currentPrice);
                setData(result);
            } catch (e: any) {
                setError(e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
        
        const interval = setInterval(fetchDetails, 30000);
        return () => clearInterval(interval);
    }, [coingeckoId, allAssets]);

    return { data, isLoading, error };
}