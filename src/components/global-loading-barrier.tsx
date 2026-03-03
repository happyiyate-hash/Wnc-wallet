
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';

/**
 * GLOBAL LOADING BARRIER
 * Ensures the entire application is blocked by the 'Establishing Identity' splash screen
 * until auth is settled, profile is fetched, and initial wallet data is hydrated.
 * Includes a failsafe timer to prevent infinite loading.
 */
export default function GlobalLoadingBarrier() {
  const { user, profile, loading: authLoading } = useUser();
  const { 
    isInitialized, 
    hasFetchedInitialData, 
    isWalletLoading,
    wallets 
  } = useWallet();

  const [showFailsafe, setShowFailsafe] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFailsafe(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  /**
   * HANDSHAKE RESOLVER
   * The app is only "Ready" when:
   * 1. Auth is settled (authenticated or unauthenticated)
   * 2. If authenticated:
   *    -> Wallet core derived (isInitialized)
   *    -> Initial market sync complete (hasFetchedInitialData)
   * 
   * ONBOARDING EXCEPTION:
   * If user is authenticated but has no wallet derived yet AND onboarding is not complete,
   * we yield the splash screen to allow the /wallet-session routing.
   */
  const needsOnboarding = user && profile && (!wallets || wallets.length === 0) && !profile.onboarding_completed;
  
  // Hard gate: loading until auth resolves, or until authenticated wallet + data are ready
  const isAppLoading = !showFailsafe && (
    authLoading || 
    (user && !needsOnboarding && (!isInitialized || !hasFetchedInitialData || isWalletLoading))
  );

  if (!isAppLoading) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#050505] text-white">
      <div className="relative mb-12 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full border-l-2 border-primary animate-spin drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]" />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-2xl bg-primary border border-primary animate-pulse drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
        </div>
      </div>
      
      <div className="space-y-4 text-center px-10">
        <h2 className="text-lg font-black uppercase tracking-[0.5em] text-white">
          Establishing Identity
        </h2>
        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-40 leading-relaxed max-w-[240px] mx-auto">
          Synchronizing Cryptographic Vault
        </p>
      </div>
    </div>
  );
}
