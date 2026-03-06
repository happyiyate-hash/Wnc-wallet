
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, polygon, base } from 'wagmi/chains';

/**
 * WEB3 PROVIDER
 * Version: 2.1.0 (SSR Stability Patch)
 * 
 * Hardened to prevent useState initialization crashes during production SSR passes.
 */

const config = createConfig({
  chains: [mainnet, polygon, base],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [base.id]: http(),
  },
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  // Use useMemo for SSR-safe client initialization to prevent dispatcher null errors
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }), []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
