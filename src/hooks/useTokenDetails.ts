'use client';

import { useState, useEffect } from 'react';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

async function fetcher(url: string) {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        // Attach extra info to the error object.
        try {
          const info = await res.json();
          console.error('API Error:', info);
        } catch (e) {
          console.error('Could not parse error JSON');
        }
        throw error;
    }
    return res.json();
}

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
                const url = `${COINGECKO_API_URL}/coins/${coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
                const result = await fetcher(url);
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