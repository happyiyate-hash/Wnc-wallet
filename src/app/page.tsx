'use client';

import { useState, useRef, useEffect } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import AuthSheet from '@/components/auth/auth-sheet';
import WalletManagementSheet from '@/components/wallet/wallet-management-sheet';

export default function Home() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const { user, loading } = useUser();
  const { wallets, isInitialized } = useWallet();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine which sheet should be open based on strict priority
  // Priority 1: Auth (Must be logged in to do anything)
  const isAuthOpen = !loading && !user;
  
  // Priority 2: Wallet Setup (Only if Auth is completed but no wallet found)
  const isWalletSetupOpen = !loading && !!user && isInitialized && !wallets;

  useEffect(() => {
    const scrollDiv = scrollRef.current;
    if (!scrollDiv) return;

    let lastScrollY = scrollDiv.scrollTop;

    const handle = () => {
      const currentScrollY = scrollDiv.scrollTop;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsHeaderCollapsed(true);
      } else {
        setIsHeaderCollapsed(false);
      }
      lastScrollY = currentScrollY;
    };

    scrollDiv.addEventListener('scroll', handle);
    return () => scrollDiv.removeEventListener('scroll', handle);
  }, []);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <WalletHeader isCollapsed={isHeaderCollapsed} />
        <main className="flex flex-col items-center">
          <div className="w-full mx-auto max-w-4xl">
            {/* Show UI only if both auth and wallet are active */}
            {user && wallets ? (
              <WalletTab />
            ) : (
              <div className="flex h-[60vh] items-center justify-center text-muted-foreground p-8 text-center">
                Please complete setup to view your assets.
              </div>
            )}
          </div>
        </main>
        
        {/* Auth takes precedence */}
        <AuthSheet isOpen={isAuthOpen} onOpenChange={() => {}} />
        
        {/* Wallet setup only pops up after auth is valid */}
        <WalletManagementSheet isOpen={isWalletSetupOpen} onOpenChange={() => {}} />
      </div>
  );
}
