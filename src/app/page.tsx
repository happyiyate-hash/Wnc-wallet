'use client';

import { useState, useRef, useEffect } from 'react';
import WalletTab from '@/components/wallet-tab';
import WalletHeader from '@/components/wallet/wallet-header';
import ConverterTab from '@/components/converter-tab';
import SecurityTab from '@/components/security-tab';
import TransactionsTab from '@/components/transactions-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Shield, Repeat, Settings, Coins } from 'lucide-react';

export default function Home() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        const { scrollTop } = scrollRef.current;
        setIsCollapsed(scrollTop > 20);
      }
    };

    const scrollDiv = scrollRef.current;
    scrollDiv?.addEventListener('scroll', handleScroll);

    return () => {
      scrollDiv?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <WalletHeader isCollapsed={isCollapsed} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-16">
        <main className="flex flex-col items-center p-4 sm:p-8 md:p-12">
          <div className="w-full max-w-4xl mx-auto">
            <Tabs defaultValue="wallet" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="wallet"><Wallet className="w-4 h-4 mr-2"/> Wallet</TabsTrigger>
                <TabsTrigger value="converter"><Coins className="w-4 h-4 mr-2"/> Converter</TabsTrigger>
                <TabsTrigger value="transactions"><Repeat className="w-4 h-4 mr-2"/> Transactions</TabsTrigger>
                <TabsTrigger value="security"><Shield className="w-4 h-4 mr-2"/> Security</TabsTrigger>
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
