'use client';

import WalletTab from '@/components/wallet-tab';

export default function Home() {

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto">
        <main className="flex flex-col items-center p-4 sm:p-8 md:p-12">
          <div className="w-full max-w-4xl mx-auto">
            <WalletTab />
          </div>
        </main>
      </div>
    </div>
  );
}
