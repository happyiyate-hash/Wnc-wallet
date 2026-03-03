
'use client';

import { useState, useEffect, Suspense } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { RequestCreateMoment, RequestReviewMoment } from '@/components/wallet/request-moments';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

// BUILD FIX: Force dynamic rendering to bypass "ReferenceError: Lock is not defined" during static prerendering
export const dynamic = 'force-dynamic';

function HomeContent() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const { user, profile, loading } = useUser();
  const { 
    isInitialized, 
    isWalletLoading, 
    isRequestOverlayOpen, 
    setIsRequestOverlayOpen, 
    activeFulfillmentId, 
    setActiveFulfillmentId,
    wallets
  } = useWallet();

  const searchParams = useSearchParams();

  // Failsafe timer to prevent infinite loading if market APIs fail
  const [showFailsafe, setShowFailsafe] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFailsafe(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  // Deep Link Interceptor: Check for fulfillment ID in URL or search params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const match = path.match(/\/request\/([^\/]+)/);
      if (match && match[1]) {
        setActiveFulfillmentId(match[1]);
      }
    }
  }, [setActiveFulfillmentId]);

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

  /**
   * INSTITUTIONAL HANDSHAKE RESOLVER
   * The app is only "Ready" when:
   * 1. Auth is settled (user is logged in)
   * 2. Profile metadata is fetched
   * 3. Wallet core is initialized (mnemonic derived + initial balances fetched)
   */
  const isAppLoading = !showFailsafe && (loading || !isInitialized || !profile || (!wallets && !!user));

  if (isAppLoading) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#050505] text-white">
        <div className="relative mb-12 flex items-center justify-center">
          {/* HIGH-BRIGHTNESS CSS SPINNER (HARDWARE ACCELERATED) */}
          <div className="w-24 h-24 rounded-full border-l-2 border-primary animate-spin shadow-[0_0_20px_rgba(139,92,246,0.4)]" />
          
          <div className="absolute inset-0 flex items-center justify-center">
            {/* BRIGHT INNER NODE */}
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/50 animate-pulse shadow-[0_0_30px_rgba(139,92,246,0.3)]" />
          </div>
        </div>
        
        <div className="space-y-4 text-center px-10">
          <h2 className="text-lg font-black uppercase tracking-[0.5em] text-white/90">
            Establishing Identity
          </h2>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-30 leading-relaxed max-w-[240px] mx-auto">
            Synchronizing Cryptographic Vault
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-transparent pb-32 relative">
      <WalletHeader isCollapsed={isHeaderCollapsed} />
      <main className={cn(
        "flex flex-col items-center transition-all duration-700 ease-out",
        (isRequestOverlayOpen || activeFulfillmentId) && "blur-xl scale-95 opacity-50 pointer-events-none"
      )}>
        <div className="w-full mx-auto max-w-4xl pt-4">
          <WalletTab />
        </div>
      </main>
      
      {/* GLOBAL P2P OVERLAY MOMENTS */}
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
