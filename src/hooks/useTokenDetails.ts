'use client';

import { useState, useEffect } from 'react';
import { fetchSingleTokenDetails } from '@/lib/coingecko';

/**
 * Hook to fetch market metadata for a specific token.
 * Optimized for "Silent Refresh" to prevent UI skeletons during background updates.
 */
export function useSingleTokenDetails(coingeckoId: string | null | undefined) {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!coingeckoId) {
            setData(null);
            return;
        };

        const fetchDetails = async () => {
            // Only show loader if we have zero data. Subsequent fetches are silent.
            if (!data) setIsLoading(true);
            setError(null);
            try {
                const result = await fetchSingleTokenDetails(coingeckoId);
                setData(result);
            } catch (e: any) {
                setError(e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
        
        // Background refresh every 30 seconds for market metadata (stats)
        const interval = setInterval(fetchDetails, 30000);
        return () => clearInterval(interval);
    }, [coingeckoId]);

    return { data, isLoading, error };
}
