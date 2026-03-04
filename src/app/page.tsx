
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { RequestCreateMoment, RequestReviewMoment } from '@/components/wallet/request-moments';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

export const dynamic = 'force-dynamic';

function HomeContent() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const { 
    isRequestOverlayOpen, 
    setIsRequestOverlayOpen, 
    activeFulfillmentId, 
    setActiveFulfillmentId,
    runCloudDiagnostic,
    isInitialized,
    wallets,
    hasFetchedInitialData,
    balances,
    prices,
    viewingNetwork,
    hiddenTokenKeys,
    userAddedTokens,
    isWalletLoading
  } = useWallet();

  const { profile } = useUser();

  // ATOMIC GATE: Prevent rendering the dashboard if the wallet node is not ready.
  // This ensures the GlobalOverlayManager has time to redirect to /wallet-session
  // if no keys are detected, preventing the "Empty Dashboard" flash.
  const isReady = isInitialized && !isWalletLoading && wallets && wallets.length > 0;

  /**
   * ASSET AGGREGATION PROTOCOL
   * This is the "Heartbeat" of the dashboard. It computes the final asset list
   * from balances, prices, and visibility rules.
   */
  const allAssets = useMemo(() => {
    if (!isReady) return [];

    const { getInitialAssets } = require('@/lib/wallets/balances');
    const base = getInitialAssets(viewingNetwork.chainId);
    const custom = userAddedTokens.filter(t => t.chainId === viewingNetwork.chainId);
    
    // Unified registry
    const registry = [...base, ...custom].reduce((acc, curr) => {
      const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
      if (!acc.find(a => (a.isNative ? a.symbol : a.address?.toLowerCase()) === identifier)) {
        acc.push(curr);
      }
      return acc;
    }, [] as any[]);

    // 1. Inject WNC (Internal Cloud Node)
    const wncAsset = {
      chainId: viewingNetwork.chainId,
      address: 'internal:wnc',
      symbol: 'WNC',
      name: 'Wevinacoin',
      balance: profile?.wnc_earnings?.toString() || '0',
      isNative: false,
      priceUsd: prices['internal:wnc']?.price || 0.0006,
      fiatValueUsd: (profile?.wnc_earnings || 0) * (prices['internal:wnc']?.price || 0.0006),
      pctChange24h: prices['internal:wnc']?.change || 0,
      decimals: 0
    };

    // 2. Map chain-specific balances and prices
    const chainBalances = balances[viewingNetwork.chainId] || [];
    const onChainAssets = registry.map(asset => {
      const balDoc = chainBalances.find(b => 
        asset.isNative ? b.symbol === asset.symbol : b.address?.toLowerCase() === asset.address?.toLowerCase()
      );
      
      const priceId = (asset.priceId || asset.coingeckoId || asset.address || '').toLowerCase();
      const marketData = prices[priceId];
      const balNum = parseFloat(balDoc?.balance || '0');

      return {
        ...asset,
        balance: balDoc?.balance || '0',
        priceUsd: marketData?.price || 0,
        fiatValueUsd: balNum * (marketData?.price || 0),
        pctChange24h: marketData?.change || 0
      };
    });

    // 3. Filter and Sort
    return [wncAsset, ...onChainAssets]
      .filter(a => !hiddenTokenKeys.has(`${viewingNetwork.chainId}:${a.symbol}`))
      .sort((a, b) => (b.fiatValueUsd || 0) - (a.fiatValueUsd || 0));
  }, [isReady, viewingNetwork, profile, balances, prices, hiddenTokenKeys, userAddedTokens]);

  /**
   * INSTITUTIONAL SYNC CONTROLLER
   */
  useEffect(() => {
    if (isReady && hasFetchedInitialData) {
      const timer = setTimeout(() => {
        runCloudDiagnostic();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isReady, hasFetchedInitialData, runCloudDiagnostic]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handle = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsHeaderCollapsed(true);
      } else {
        setIsHeaderCollapsed(false);
      }
      lastScrollY = currentScrollY;
    };
    window.addEventListener('scroll', handle);
    return () => window.removeEventListener('scroll', handle);
  }, []);

  if (!isReady) return null;

  return (
    <div className="flex-1 bg-transparent pb-32 relative">
      <WalletHeader isCollapsed={isHeaderCollapsed} />
      <main className={cn(
        "flex flex-col items-center transition-all duration-700 ease-out",
        (isRequestOverlayOpen || activeFulfillmentId) && "blur-xl scale-95 opacity-50 pointer-events-none"
      )}>
        <div className="w-full mx-auto max-w-4xl pt-4">
          <WalletTab computedAssets={allAssets} />
        </div>
      </main>
      
      <RequestCreateMoment isOpen={isRequestOverlayOpen} onClose={() => setIsRequestOverlayOpen(false)} />
      {activeFulfillmentId && <RequestReviewMoment requestId={activeFulfillmentId} onClose={() => setActiveFulfillmentId(null)} />}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
