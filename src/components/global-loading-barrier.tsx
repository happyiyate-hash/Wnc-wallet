
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';

/**
 * GLOBAL LOADING BARRIER (Institutional Gate)
 * Hardened to ensure the UI remains blocked until all cryptographic
 * AND data nodes (balances/prices) are fully synchronized.
 * 
 * NAVIGATION OPTIMIZED: Once dismissed, this barrier remains hidden
 * during internal routing to prevent jarring UX.
 * 
 * HYDRATION FIX: Synchronizes initial server/client text nodes.
 */
export default function GlobalLoadingBarrier() {
  const { user, loading: authLoading } = useUser();
  const { isInitialized, wallets, hasFetchedInitialData } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const hasHydratedOnceRef = useRef(false);
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const isAuthResolved = !authLoading;
  const isWalletResolved = isInitialized;
  const hasWallet = wallets && wallets.length > 0;
  
  // Data Resolve Rule: If user has a wallet, we MUST wait for the first data burst.
  const isDataResolved = !user || !hasWallet || hasFetchedInitialData;

  const isAppReady = hasMounted && isAuthResolved && isWalletResolved && isDataResolved;

  // Once the app is ready for the first time, we mark it as hydrated and hide the barrier permanently for this session
  useEffect(() => {
    if (isAppReady && !hasHydratedOnceRef.current) {
      hasHydratedOnceRef.current = true;
      // Delay removal slightly for a smooth fade-out feel
      const timer = setTimeout(() => setIsVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isAppReady]);

  // If already hydrated in this session, never show the barrier again during navigation
  if (hasHydratedOnceRef.current || !isVisible) return null;

  // Determine the most accurate feedback for the user
  // HYDRATION GUARD: Ensure initial client render matches server assumption (authLoading = true)
  const getStatusText = () => {
    if (!hasMounted) return 'Verifying Identity...';
    if (!isAuthResolved) return 'Verifying Identity...';
    if (!isWalletResolved) return 'Deriving Secure Nodes...';
    if (!isDataResolved) return 'Synchronizing Registry...';
    return 'Establishing Terminal...';
  };

  const statusText = getStatusText();

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#050505] text-white transition-opacity duration-500">
      <div className="relative mb-12 flex items-center justify-center">
        {/* Outer spin ring */}
        <div className="w-24 h-24 rounded-full border-t-2 border-primary animate-spin shadow-[0_0_30px_rgba(139,92,246,0.2)]" />
        
        {/* Inner hardware node */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-primary border border-primary/50 animate-pulse shadow-[0_0_20px_rgba(139,92,246,0.4)]" />
        </div>
      </div>
      
      <div className="space-y-4 text-center px-10">
        <h2 className="text-xl font-black uppercase tracking-[0.5em] text-white drop-shadow-2xl">
          Wevina
        </h2>
        <div className="flex flex-col items-center gap-2">
          <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
          </div>
          <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] animate-pulse">
            {statusText}
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}
