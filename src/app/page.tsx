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

  // Handshake determination
  const isAppLoading = !showFailsafe && (loading || !isInitialized || isWalletLoading) && !wallets && !!user;

  if (isAppLoading) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#050505] text-white">
        <div className="relative mb-16">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-40 h-40 rounded-full border-l-[1px] border-primary/40"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-[2rem] bg-primary/10 border border-primary/20 animate-pulse shadow-[0_0_40px_rgba(139,92,246,0.1)]" />
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
