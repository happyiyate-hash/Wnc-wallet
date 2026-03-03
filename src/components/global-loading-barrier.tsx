
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';

/**
 * GLOBAL LOADING BARRIER (Institutional Gate)
 * Hardened to ensure the UI remains blocked until all cryptographic nodes are ready.
 */
export default function GlobalLoadingBarrier() {
  const { loading: authLoading } = useUser();
  const { isInitialized, isWalletLoading } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // BLOCKING LOGIC:
  // We wait until the component has mounted AND the wallet provider signals completion.
  // This prevents the "empty UI" flicker and hydration mismatches.
  const isAppReady = hasMounted && isInitialized && !authLoading;

  if (!isAppReady) {
    return (
      <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#050505] text-white">
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
              Deriving Secure Nodes...
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

  return null;
}
