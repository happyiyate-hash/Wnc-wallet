
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';

/**
 * GLOBAL LOADING BARRIER
 * Version: 7.0.0 (Instant-Hydration Sentinel)
 * 
 * Releases as soon as core configuration and local identity nodes are initialized.
 * Does not wait for blockchain RPC balance fetches.
 */
export default function GlobalLoadingBarrier() {
  const { loading: authLoading } = useUser();
  const { isInitialized } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  const hasHydratedOnceRef = useRef(false);
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    setHasMounted(true);
    
    // SAFETY SENTINEL: Hard drop after 8 seconds
    const timer = setTimeout(() => {
      hasHydratedOnceRef.current = true;
      setIsVisible(false);
    }, 8000);
    
    return () => clearTimeout(timer);
  }, []);

  // INSTANT HYDRATION: Release barrier once session and wallet nodes are initialized
  const isAppReady = hasMounted && !authLoading && isInitialized;

  useEffect(() => {
    if (isAppReady && !hasHydratedOnceRef.current) {
      hasHydratedOnceRef.current = true;
      const timer = setTimeout(() => setIsVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isAppReady]);

  if (hasHydratedOnceRef.current || !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#050505] text-white transition-opacity duration-500">
      <div className="relative mb-12 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full border-t-2 border-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-primary border border-primary/50 animate-pulse shadow-[0_0_20px_rgba(139,92,246,0.4)]" />
        </div>
      </div>
      
      <div className="space-y-4 text-center px-10">
        <h2 className="text-xl font-black uppercase tracking-[0.5em] text-white">
          Wevina
        </h2>
        <div className="flex flex-col items-center gap-2">
          <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
          </div>
          <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] animate-pulse">
            Establishing Terminal...
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
