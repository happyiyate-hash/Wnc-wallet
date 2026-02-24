
'use client';

import { useState, useRef, useEffect } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import AuthSheet from '@/components/auth/auth-sheet';
import WalletManagementSheet from '@/components/wallet/wallet-management-sheet';
import { cn } from '@/lib/utils';

export default function Home() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const { user, loading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine which sheet should be open based on strict priority
  const isAuthOpen = !loading && !user;
  const isWalletSetupOpen = !loading && !!user && isInitialized && !isWalletLoading && !wallets;

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
      <main className={cn(
        "flex flex-col items-center transition-all duration-500",
        (isAuthOpen || isWalletSetupOpen) && "blur-md pointer-events-none"
      )}>
        <div className="w-full mx-auto max-w-4xl">
          <WalletTab />
        </div>
      </main>
      
      <AuthSheet isOpen={isAuthOpen} onOpenChange={() => {}} />
      <WalletManagementSheet isOpen={isWalletSetupOpen} onOpenChange={() => {}} />
    </div>
  );
}
