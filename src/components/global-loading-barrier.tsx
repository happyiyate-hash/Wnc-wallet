'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';

/**
 * GLOBAL LOADING BARRIER (Hydration-Safe)
 * Optimized for SWR performance while ensuring server/client parity.
 */
export default function GlobalLoadingBarrier() {
  const { loading: authLoading, profile } = useUser();
  const [hasMounted, setHasMounted] = useState(false);
  const [showFailsafe, setShowFailsafe] = useState(false);
  
  useEffect(() => {
    setHasMounted(true);
    const timer = setTimeout(() => {
      setShowFailsafe(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const hasCachedData = !!profile;
  const isAppLoading = !showFailsafe && authLoading && !hasCachedData;

  // Render identical UI on server and first client pass to avoid hydration mismatch
  if (!hasMounted || isAppLoading) {
    return (
      <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#050505] text-white">
        <div className="relative mb-12 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border-l-2 border-primary animate-spin shadow-[0_0_20px_rgba(139,92,246,0.1)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-2xl bg-primary border border-primary animate-pulse" />
          </div>
        </div>
        
        <div className="space-y-4 text-center px-10">
          <h2 className="text-lg font-black uppercase tracking-[0.5em] text-white">
            Wevina
          </h2>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-40 leading-relaxed max-w-[240px] mx-auto">
            Synchronizing Registry Node
          </p>
        </div>
      </div>
    );
  }

  return null;
}
