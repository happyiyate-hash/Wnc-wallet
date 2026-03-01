
'use client';

import { useState, useEffect, Suspense } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { RequestCreateMoment, RequestReviewMoment } from '@/components/wallet/request-moments';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';

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

  // Failsafe timer to prevent infinite loading
  const [showFailsafe, setShowFailsafe] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFailsafe(true);
    }, 8000);
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

  // PRODUCTION OPTIMIZATION: If we have cached wallets or profile, bypass splash
  const hasCachedIdentity = !!profile || !!wallets;
  const isAppLoading = !showFailsafe && (loading || !isInitialized || isWalletLoading) && !hasCachedIdentity && !!user;

  if (isAppLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#050505] text-white">
        <div className="relative">
          <div className="h-24 w-24 rounded-[2rem] border-t-2 border-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 animate-pulse border border-primary/20" />
          </div>
        </div>
        <div className="mt-10 space-y-3 text-center">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] animate-pulse text-white/90">
            {loading ? "Establishing Identity" : "Initializing Secure Node"}
          </h2>
          <div className="flex items-center justify-center gap-2">
            <div className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <div className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <div className="h-1 w-1 rounded-full bg-primary animate-bounce" />
          </div>
          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest opacity-40 pt-2">
            {isWalletLoading ? "Synchronizing Cryptographic Vault" : "Establishing Institutional Tunnel"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background pb-32 relative">
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
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-[#050505]">
        <div className="h-12 w-12 rounded-2xl border-t-2 border-primary animate-spin" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
