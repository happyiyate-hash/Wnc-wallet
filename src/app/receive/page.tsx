'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Share2, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Card } from '@/components/ui/card';
import type { AssetRow } from '@/lib/types';
import { getAddressForChain } from '@/lib/wallets/utils';
import { cn } from '@/lib/utils';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import QRCode from "react-qr-code";

function ReceiveClient() {
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
        if (found) { setSelectedToken({ ...found }); return; }
    }
    const initial = allAssets.find(a => a.chainId === viewingNetwork.chainId) || allAssets[0];
    if (initial) setSelectedToken({ ...initial });
  }, [viewingNetwork, allAssets, searchParams]);

  const chain = useMemo(() => allChains.find(c => c.chainId === selectedToken?.chainId) || viewingNetwork, [allChains, selectedToken, viewingNetwork]);
  const address = useMemo(() => wallets ? getAddressForChain(chain, wallets) : null, [chain, wallets]);
  const qrValue = useMemo(() => address ? `ethereum:${address}` : "", [address]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex flex-col items-center text-center"><h1 className="text-lg font-black uppercase tracking-tight">Receive {selectedToken?.symbol}</h1><span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">{chain.name}</span></div>
        <Button variant="ghost" size="icon" className="rounded-xl"><Info className="w-5 h-5" /></Button>
      </header>
      <main className="flex-1 p-6 flex flex-col items-center gap-8 overflow-y-auto thin-scrollbar">
        <div className="text-center space-y-2 px-4"><p className="text-sm text-muted-foreground leading-relaxed">Send only <span className="text-foreground font-black">{selectedToken?.name || selectedToken?.symbol}</span> to this address via the <span className="text-primary font-black">{chain.name}</span> network.</p></div>
        <div className="relative group"><div className="absolute -inset-6 bg-primary/20 rounded-[4rem] blur-2xl opacity-50 transition-opacity duration-1000" /><Card className="p-10 bg-white rounded-[3.5rem] shadow-2xl relative z-10 flex flex-col items-center gap-6"><div className="bg-white p-4 rounded-[2.5rem] relative w-[240px] h-[240px] flex items-center justify-center">{address ? (<div className="animate-in fade-in zoom-in duration-500"><QRCode value={qrValue} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} fgColor="#000000" bgColor="#FFFFFF" level="H" /></div>) : (<div className="w-full h-full flex items-center justify-center bg-zinc-100 rounded-3xl animate-pulse"><span className="text-xs text-muted-foreground font-mono">Synchronizing...</span></div>)}{address && (<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="p-2 bg-white rounded-2xl shadow-2xl border border-zinc-100 animate-in fade-in zoom-in delay-300 duration-500"><TokenLogoDynamic logoUrl={selectedToken?.iconUrl} alt={selectedToken?.symbol || ''} size={44} chainId={selectedToken?.chainId} symbol={selectedToken?.symbol} name={selectedToken?.name}/></div></div>)}</div></Card></div>
        <div className="w-full space-y-4"><div onClick={() => address && copy(address)} className={cn("w-full p-6 rounded-[2rem] border flex items-center justify-between cursor-pointer transition-all duration-300 relative overflow-hidden shadow-xl", isCopied ? "bg-green-500/10 border-green-500/30" : "bg-secondary/30 border-white/10 hover:border-primary/30")}><div className="flex-1 min-w-0 pr-4 relative z-10"><p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black mb-2 flex items-center gap-2">Your Vault Address{isCopied && <span className="text-green-500 text-[9px] font-bold">COPIED!</span>}</p><p className={cn("text-sm font-mono break-all leading-relaxed tracking-tight", isCopied ? "text-green-400" : "text-foreground/90")}>{address || 'Initializing secure node...'}</p></div><div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shrink-0 shadow-lg", isCopied ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary")}>{isCopied ? <CheckCircle2 className="w-6 h-6" /> : <Copy className="w-6 h-6" />}</div></div></div>
      </main>
    </div>
  );
}

export default function ReceivePage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ReceiveClient />
    </Suspense>
  );
}
