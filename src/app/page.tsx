'use client';

import { useState, useRef, useEffect } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import AuthSheet from '@/components/auth/auth-sheet';
import WalletManagementSheet from '@/components/wallet/wallet-management-sheet';
import { cn } from '@/lib/utils';
import { Loader2, Timer } from 'lucide-react';

export default function Home() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const { user, loading } = useUser();
  const { wallets, isInitialized, isWalletLoading } = useWallet();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Failsafe timer to prevent infinite loading if a network request hangs
  const [showFailsafe, setShowFailsafe] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFailsafe(true);
    }, 6000); // 6 second failsafe
    return () => clearTimeout(timer);
  }, []);

  // Controlled states for sheets
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isWalletSetupOpen, setIsWalletSetupOpen] = useState(false);

  // APP INITIALIZATION GATE
  // The app is loading if auth is pending, networks aren't ready, OR wallet derivation is still checking local storage.
  // We include the failsafe to ensure the app ALWAYS mounts eventually.
  const isAppLoading = !showFailsafe && (loading || !isInitialized || isWalletLoading);

  // Derive intended sheet states to prevent race conditions/flickering
  const shouldShowAuth = !loading && !user;
  const shouldShowSetup = !loading && !!user && isInitialized && !isWalletLoading && !wallets;

  // Sync Auth Sheet
  useEffect(() => {
    if (!isAppLoading) {
      setIsAuthOpen(shouldShowAuth);
    }
  }, [shouldShowAuth, isAppLoading]);

  // Sync Wallet Setup
  useEffect(() => {
    if (!isAppLoading) {
      setIsWalletSetupOpen(shouldShowSetup);
    }
  }, [shouldShowSetup, isAppLoading]);

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

  // FULL SCREEN INITIALIZATION LOADER
  if (isAppLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#050505] text-white">
        <div className="relative">
          {/* Animated institutional ring */}
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
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-background">
      <WalletHeader isCollapsed={isHeaderCollapsed} />
      <main className={cn(
        "flex flex-col items-center transition-all duration-700 ease-out",
        (isAuthOpen || isWalletSetupOpen) && "blur-xl scale-95 opacity-50 pointer-events-none"
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
