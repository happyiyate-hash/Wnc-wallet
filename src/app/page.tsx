'use client';

import { useState, useRef, useEffect } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { useUser } from '@/contexts/user-provider';
import AuthSheet from '@/components/auth/auth-sheet';

export default function Home() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { user, loading } = useUser();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      setIsAuthOpen(true);
    }
  }, [user, loading]);

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
        
        <AuthSheet isOpen={isAuthOpen} onOpenChange={setIsAuthOpen} />
      </div>
  );
}
