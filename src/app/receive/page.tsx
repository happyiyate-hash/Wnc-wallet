
'use client';

import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Share2, Info, CheckCircle2, QrCode } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Card } from '@/components/ui/card';
import { useEffect, useState, useMemo } from 'react';
import type { AssetRow } from '@/lib/types';
import { getAddressForChain } from '@/lib/wallets/utils';
import { cn } from '@/lib/utils';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';

export default function ReceivePage() {
  const { wallets, viewingNetwork, allChains, allAssets } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCopied, copy] = useCopyToClipboard();
  
  const [selectedToken, setSelectedToken] = useState<AssetRow | null>(null);

  useEffect(() => {
    const symbol = searchParams.get('symbol');
    const chainId = parseInt(searchParams.get('chainId') || '');
    
    if (symbol && !isNaN(chainId)) {
        const found = allAssets.find(a => a.symbol === symbol && a.chainId === chainId);
        if (found) {
            setSelectedToken({ ...found });
            return;
        }
    }

    const initial = allAssets.find(a => a.chainId === viewingNetwork.chainId) || allAssets[0];
    if (initial) {
        setSelectedToken({ ...initial });
    }
  }, [viewingNetwork, allAssets, searchParams]);

  const chain = useMemo(() => 
    allChains.find(c => c.chainId === selectedToken?.chainId) || viewingNetwork,
  [allChains, selectedToken, viewingNetwork]);

  const address = useMemo(() => 
    wallets ? getAddressForChain(chain, wallets) : null,
  [chain, wallets]);

  const handleCopy = () => {
    if (address) copy(address);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold">Receive {selectedToken?.symbol}</h1>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{chain.name}</span>
        </div>
        <Button variant="ghost" size="icon">
          <Info className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center gap-8 overflow-y-auto thin-scrollbar">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground px-4 leading-relaxed">
            Send only <span className="text-foreground font-bold">{selectedToken?.name || selectedToken?.symbol}</span> to this address via <span className="text-primary font-bold">{chain.name}</span>.
          </p>
        </div>

        <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 rounded-[4rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
            <Card className="p-10 bg-white rounded-[3.5rem] shadow-2xl relative z-10 flex flex-col items-center gap-6">
                <div className="bg-zinc-50 p-4 rounded-[2.5rem] border border-zinc-100 relative w-[220px] h-[220px] flex items-center justify-center">
                    {address ? (
                        <div className="flex flex-col items-center gap-2 text-zinc-400">
                            <QrCode className="w-24 h-24 opacity-20" />
                            <span className="text-[10px] font-mono text-center px-4">QR System Ready</span>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-100 rounded-3xl animate-pulse">
                            <span className="text-xs text-muted-foreground font-mono">Connecting...</span>
                        </div>
                    )}
                    
                    {address && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="p-2 bg-white rounded-xl shadow-lg border border-zinc-100">
                                <TokenLogoDynamic 
                                    logoUrl={selectedToken?.iconUrl} 
                                    alt={selectedToken?.symbol || ''} 
                                    size={44} 
                                    chainId={selectedToken?.chainId} 
                                    symbol={selectedToken?.symbol}
                                    name={selectedToken?.name}
                                />
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Scan to pay</span>
                    <div className="h-1 w-8 bg-primary/20 rounded-full" />
                </div>
            </Card>
        </div>

        <div className="w-full space-y-4">
          <div 
            onClick={handleCopy}
            className={cn(
                "w-full p-5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-300 relative overflow-hidden group",
                isCopied 
                    ? "bg-green-500/10 border-green-500/30" 
                    : "bg-secondary/30 border-white/10 hover:border-primary/30"
            )}
          >
            <div className="flex-1 min-w-0 pr-4 relative z-10">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 flex items-center gap-2">
                Your Receiving Address
                {isCopied && <span className="text-green-500 text-[9px] animate-in fade-in slide-in-from-left-1">Copied!</span>}
              </p>
              <p className={cn(
                "text-sm font-mono break-all leading-relaxed transition-colors",
                isCopied ? "text-green-400" : "text-foreground/90"
              )}>
                {address || 'Configuring secure vault...'}
              </p>
            </div>
            <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 relative z-10 shrink-0",
                isCopied ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary group-hover:scale-110"
            )}>
              {isCopied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </div>
            {isCopied && <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent animate-in slide-in-from-left-full duration-700" />}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Button 
                variant="outline" 
                className="h-14 rounded-2xl gap-3 font-bold text-base bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all active:scale-95" 
                onClick={handleCopy}
             >
                <Copy className="w-5 h-5 text-primary" /> Copy
             </Button>
             <Button 
                variant="outline" 
                className="h-14 rounded-2xl gap-3 font-bold text-base bg-white/5 border-white/10 hover:bg-white/10 transition-all active:scale-95"
             >
                <Share2 className="w-5 h-5 text-primary" /> Share
             </Button>
          </div>
        </div>

        <div className="mt-auto p-5 rounded-2xl bg-primary/5 border border-primary/10 text-muted-foreground text-[11px] leading-relaxed italic text-center max-w-[280px]">
           Deposits are automatically detected and credited to your balance after network confirmation.
        </div>
      </main>
    </div>
  );
}
