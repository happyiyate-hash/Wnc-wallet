
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

  // Controlled states for sheets to ensure they can be dismissed
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isWalletSetupOpen, setIsWalletSetupOpen] = useState(false);

  // Sync Auth Sheet visibility
  useEffect(() => {
    if (!loading && !user) {
      setIsAuthOpen(true);
    } else {
      setIsAuthOpen(false);
    }
  }, [loading, user]);

  // Sync Wallet Setup Sheet visibility (Strict Priority)
  useEffect(() => {
    // Only show if user is logged in, Firebase is ready, wallet isn't loading, and no wallets exist yet
    if (!loading && !!user && isInitialized && !isWalletLoading && !wallets) {
      setIsWalletSetupOpen(true);
    } else {
      setIsWalletSetupOpen(false);
    }
  }, [loading, user, isInitialized, isWalletLoading, wallets]);

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
      
      <AuthSheet 
        isOpen={isAuthOpen} 
        onOpenChange={setIsAuthOpen} 
      />
      <WalletManagementSheet 
        isOpen={isWalletSetupOpen} 
        onOpenChange={setIsWalletSetupOpen} 
      />
    </div>
  );
}
