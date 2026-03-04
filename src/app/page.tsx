
'use client';

import { useState, useEffect, Suspense } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { RequestCreateMoment, RequestReviewMoment } from '@/components/wallet/request-moments';
import { cn } from '@/lib/utils';

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
    hasFetchedInitialData,
    allAssets,
    isWalletLoading
  } = useWallet();

  // ATOMIC GATE: Monitor wallet and data readiness
  // Dashboard should only render once cryptography and initial data node are synchronized
  const isReady = isInitialized && !isWalletLoading && wallets && wallets.length > 0 && hasFetchedInitialData;

  /**
   * INSTITUTIONAL SYNC CONTROLLER
   */
  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        runCloudDiagnostic();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isReady, runCloudDiagnostic]);

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

  if (!isReady) return null;

  return (
    <div className="flex-1 bg-transparent pb-32 relative">
      <WalletHeader isCollapsed={isHeaderCollapsed} />
      <main className={cn(
        "flex flex-col items-center transition-all duration-700 ease-out",
        (isRequestOverlayOpen || activeFulfillmentId) && "blur-xl scale-95 opacity-50 pointer-events-none"
      )}>
        <div className="w-full mx-auto max-w-4xl pt-4">
          <WalletTab computedAssets={allAssets} />
        </div>
      </main>
      
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
