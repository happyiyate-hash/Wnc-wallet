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
   * 1. Auth is settled
   * 2. Profile metadata is fetched
   * 3. Wallet core is initialized AND initial data (balances/prices) are hydrated
   * 
   * ONBOARDING EXCEPTION:
   * If the user needs onboarding, we yield to allow the GlobalOverlayManager to route them.
   */
  const needsOnboarding = user && profile && (!wallets || wallets.length === 0) && !profile.onboarding_completed;
  const isAppLoading = !showFailsafe && !needsOnboarding && (authLoading || (user && (!isInitialized || !profile || !hasFetchedInitialData)));

  if (!isAppLoading) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#050505] text-white">
      <div className="relative mb-12 flex items-center justify-center">
        {/* HARDWARE-ACCELERATED CSS SPINNER - Glowing shadows removed */}
        <div className="w-24 h-24 rounded-full border-l-2 border-primary animate-spin drop-shadow-xl" />
        
        <div className="absolute inset-0 flex items-center justify-center">
          {/* BRIGHT INNER NODE - Glowing shadows removed */}
          <div className="w-10 h-10 rounded-2xl bg-primary border border-primary animate-pulse drop-shadow-md" />
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
