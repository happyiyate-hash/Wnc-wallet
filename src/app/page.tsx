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

  // Determine which sheet should be open
  const isAuthOpen = !loading && !user;
  const isWalletSetupOpen = !loading && !!user && isInitialized && !wallets;

  useEffect(() => {
    const scrollDiv = scrollRef.current;
    if (!scrollDiv) return;

    let lastScrollY = scrollDiv.scrollTop;

    const handleScroll = () => {
      const currentScrollY = scrollDiv.scrollTop;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsHeaderCollapsed(true);
      } else {
        setIsHeaderCollapsed(false);
      }
      lastScrollY = currentScrollY;
    };

    scrollDiv.addEventListener('scroll', handleScroll);
    return () => scrollDiv.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <WalletHeader isCollapsed={isHeaderCollapsed} />
        <main className="flex flex-col items-center">
          <div className="w-full mx-auto max-w-4xl">
            <WalletTab />
          </div>
        </main>
        
        {/* Priority 1: Auth */}
        <AuthSheet isOpen={isAuthOpen} onOpenChange={() => {}} />
        
        {/* Priority 2: Wallet Setup (Only if Auth is done) */}
        <WalletManagementSheet isOpen={isWalletSetupOpen} onOpenChange={() => {}} />
      </div>
  );
}
