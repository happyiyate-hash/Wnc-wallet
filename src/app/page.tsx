'use client';

import { useState, useRef, useEffect } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';

export default function Home() {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollDiv = scrollRef.current;
    if (!scrollDiv) return;

    let lastScrollY = scrollDiv.scrollTop;

    const handleScroll = () => {
      const currentScrollY = scrollDiv.scrollTop;
      // Collapse header when scrolling down, show when scrolling up
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
    <div className="flex flex-col h-screen">
      <WalletHeader isCollapsed={isHeaderCollapsed} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <main className="flex flex-col items-center">
          <div className="w-full mx-auto">
            <WalletTab />
          </div>
        </main>
      </div>
    </div>
  );
}
