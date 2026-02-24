'use client';

import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Share2, Info, QrCode } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Card } from '@/components/ui/card';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { useEffect, useState } from 'react';
import { getInitialAssets } from '@/lib/wallets/balances';
import type { AssetRow } from '@/lib/types';
import { getAddressForChain } from '@/lib/wallets/utils';

export default function ReceivePage() {
  const { wallets, viewingNetwork, allChains } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCopied, copy] = useCopyToClipboard();
  
  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(null);

  useEffect(() => {
    const symbol = searchParams.get('symbol');
    const chainId = parseInt(searchParams.get('chainId') || '');
    
    if (symbol && !isNaN(chainId)) {
        const assets = getInitialAssets(chainId);
        const found = assets.find(a => a.symbol === symbol);
        if (found) {
            setSelectedToken({ ...found, balance: '0' } as AssetRow);
            return;
        }
    }

    // Default to native token of current viewing network
    const initial = getInitialAssets(viewingNetwork.chainId)[0];
    if (initial) {
        setSelectedToken({ ...initial, balance: '0' } as AssetRow);
    }
  }, [viewingNetwork, searchParams]);

  const chain = allChains.find(c => c.chainId === selectedToken?.chainId) || viewingNetwork;
  const address = wallets ? getAddressForChain(chain, wallets) : null;

  const handleCopy = () => {
    if (address) copy(address);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Receive {selectedToken?.symbol}</h1>
        <Button variant="ghost" size="icon">
          <Info className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center gap-8 overflow-y-auto">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground px-4">
            Send only <span className="text-foreground font-bold">{selectedToken?.name} ({selectedToken?.symbol})</span> to this unique address.
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                Network: {chain.name}
            </span>
          </div>
        </div>

        <Card className="p-8 bg-white rounded-[3rem] shadow-2xl shadow-primary/20 relative group overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 w-64 h-64 bg-zinc-950 flex flex-col items-center justify-center rounded-[2.5rem] p-6">
            <div className="relative w-full h-full flex items-center justify-center">
                {/* QR Code Placeholder UI */}
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-2 opacity-20">
                    {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-sm" />
                    ))}
                </div>
                <div className="relative z-10 bg-white p-3 rounded-2xl shadow-xl">
                    <TokenLogoDynamic 
                        logoUrl={selectedToken?.iconUrl} 
                        alt={selectedToken?.symbol || ''} 
                        size={80} 
                        chainId={selectedToken?.chainId}
                        className="bg-white"
                    />
                </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center gap-2">
            <QrCode className="w-6 h-6 text-zinc-400" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Scan to pay</span>
          </div>
        </Card>

        <div className="w-full space-y-4">
          <div 
            onClick={handleCopy}
            className="w-full p-5 rounded-2xl bg-secondary/30 border border-white/10 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group"
          >
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Your Receiving Address</p>
              <p className="text-sm font-mono break-all leading-relaxed text-foreground/90">
                {address || 'Fetching address...'}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary/20 group-hover:bg-primary/30 rounded-xl flex items-center justify-center text-primary transition-colors">
              <Copy className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Button variant="outline" className="h-14 rounded-2xl gap-2 font-bold text-base bg-white/5 border-white/10" onClick={handleCopy}>
                <Copy className="w-5 h-5" /> Copy
             </Button>
             <Button variant="outline" className="h-14 rounded-2xl gap-2 font-bold text-base bg-white/5 border-white/10">
                <Share2 className="w-5 h-5" /> Share
             </Button>
          </div>
        </div>

        <div className="mt-auto p-5 rounded-2xl bg-primary/5 border border-primary/10 text-muted-foreground text-[11px] leading-relaxed italic text-center">
           Deposits are automatically detected and credited to your balance after network confirmation.
        </div>
      </main>
    </div>
  );
}
