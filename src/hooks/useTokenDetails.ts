'use client';

import { useState, useEffect } from 'react';
import { fetchSingleTokenDetails } from '@/lib/coingecko';

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
            setIsLoading(true);
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
    }, [coingeckoId]);

    return { data, isLoading, error };
}
