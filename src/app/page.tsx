
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
  const { 
    isRequestOverlayOpen, 
    setIsRequestOverlayOpen, 
    activeFulfillmentId, 
    setActiveFulfillmentId,
    runCloudDiagnostic,
    isInitialized,
    wallets,
    hasFetchedInitialData
  } = useWallet();

  const searchParams = useSearchParams();

  /**
   * INSTITUTIONAL SYNC CONTROLLER
   * Gated by Dashboard Mount Lifecycle.
   * Ensures the audit only starts after the UI has fully stabilized.
   */
  useEffect(() => {
    if (isInitialized && wallets && wallets.length > 0 && hasFetchedInitialData) {
      const timer = setTimeout(() => {
        runCloudDiagnostic();
      }, 2000); // Deliberate 2s dwell for dashboard readiness
      return () => clearTimeout(timer);
    }
  }, [isInitialized, wallets, hasFetchedInitialData, runCloudDiagnostic]);

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
