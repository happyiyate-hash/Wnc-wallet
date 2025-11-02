'use client';

import { useState, useRef, useEffect } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ConverterTab from '@/components/converter-tab';
import SecurityTab from '@/components/security-tab';
import TransactionsTab from '@/components/transactions-tab';
import { Wallet, ShieldCheck, Repeat, History } from 'lucide-react';

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
        <main className="flex flex-col items-center p-4 sm:p-8 md:p-12">
          <div className="w-full max-w-4xl mx-auto">
            <Tabs defaultValue="wallet">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="wallet">
                  <Wallet className="mr-2" />
                  Wallet
                </TabsTrigger>
                <TabsTrigger value="converter">
                  <Repeat className="mr-2" />
                  Converter
                </TabsTrigger>
                <TabsTrigger value="transactions">
                    <History className="mr-2"/>
                    Transactions
                </TabsTrigger>
                <TabsTrigger value="security">
                  <ShieldCheck className="mr-2" />
                  Security
                </TabsTrigger>
              </TabsList>
              <TabsContent value="wallet">
                <WalletTab />
              </TabsContent>
              <TabsContent value="converter">
                <ConverterTab />
              </TabsContent>
              <TabsContent value="transactions">
                <TransactionsTab />
              </TabsContent>
              <TabsContent value="security">
                <SecurityTab />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
