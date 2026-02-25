'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import AuthSheet from '@/components/auth/auth-sheet';
import WalletManagementSheet from '@/components/wallet/wallet-management-sheet';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const { user, loading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Controlled states for sheets
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isWalletSetupOpen, setIsWalletSetupOpen] = useState(false);

  // Derive intended sheet states to prevent race conditions/flickering
  const shouldShowAuth = !loading && !user;
  const shouldShowSetup = !loading && !!user && isInitialized && !isWalletLoading && !wallets;

  // Sync Auth Sheet
  useEffect(() => {
    setIsAuthOpen(shouldShowAuth);
  }, [shouldShowAuth]);

  // Sync Wallet Setup (Strict Priority)
  useEffect(() => {
    setIsWalletSetupOpen(shouldShowSetup);
  }, [shouldShowSetup]);

  // Handle scroll-based header collapse
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

  // GATEKEEPER: Prevent any flickering during initial profile/wallet resolution
  if (loading || (!!user && isWalletLoading && !wallets)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
            Initializing Secure Node...
          </p>
        </div>
      </div>
    );
  }

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
