
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from '@/contexts/wallet-provider';
import { Plane, Timer, Fuel, Loader2, X, ChevronRight, ArrowLeft } from 'lucide-react';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getInitialAssets } from '@/lib/wallets/balances';
import { Skeleton } from '../ui/skeleton';

interface QuickSwapPanelProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function QuickSwapPanel({ isOpen, onOpenChange }: QuickSwapPanelProps) {
  const { allAssets, viewingNetwork, wallets, infuraApiKey, allChains, balances } = useWallet();
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Selection Sheets State
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  useEffect(() => {
    if (allAssets.length >= 2 && !fromToken) {
        setFromToken(allAssets[0]);
        setToToken(allAssets.find(a => a.symbol !== allAssets[0].symbol) || allAssets[1]);
    }
  }, [allAssets, fromToken]);

  useEffect(() => {
    const fetchQuickQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey) {
        setQuote(null);
        return;
      }
      
      setIsQuoteLoading(true);
      setFetchError(null);
      
      try {
        const fromAddr = fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address;
        const toAddr = toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address;
        
        // Use standard EVM address for quote or fall back to first wallet
        const userAddr = wallets?.find(w => w.type === 'evm')?.address || '0x0000000000000000000000000000000000000000';

        const params = new URLSearchParams({
          fromChain: fromToken.chainId.toString(),
          toChain: toToken.chainId.toString(),
          fromToken: fromAddr,
          toToken: toAddr,
          fromAmount: ethers.parseUnits(debouncedAmount, 18).toString(),
          fromAddress: userAddr,
          slippage: '0.005'
        });

        const res = await fetch(`/api/bridge/quote?${params.toString()}`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.details || data.error);
        setQuote(data);
      } catch (e: any) {
        console.warn("Quick swap quote failed", e.message);
        setFetchError(e.message);
        setQuote(null);
      } finally {
        setIsQuoteLoading(false);
      }
    };
    fetchQuickQuote();
  }, [debouncedAmount, fromToken, toToken, wallets, infuraApiKey]);

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
    setQuote(null);
  };

  const estimatedReceived = quote?.estimate?.toAmount 
    ? ethers.formatUnits(quote.estimate.toAmount, 18) 
    : '0.00';

  const executionTimeMin = quote?.estimate?.executionDuration 
    ? Math.ceil(quote.estimate.executionDuration / 60) 
    : 0;

  const gasCostUsd = quote?.estimate?.gasCosts?.reduce((acc: number, cost: any) => acc + parseFloat(cost.amountUsd || '0'), 0) || 0;

  return (
    <>
        <div 
            className={cn(
                "fixed top-4 left-4 right-4 z-[100] transition-all duration-500 ease-in-out pointer-events-none",
                isOpen ? "translate-y-0 opacity-100" : "-translate-y-[120%] opacity-0"
            )}
        >
            <div className="bg-zinc-950/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)] p-5 max-w-sm mx-auto pointer-events-auto relative overflow-hidden group">
                {/* Background Glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-[0.25em] text-primary/80">Institutional Quick Exchange</span>
                    </div>
                    <button 
                        onClick={() => onOpenChange(false)}
                        className="p-1.5 rounded-full hover:bg-white/10 transition-colors bg-white/5 border border-white/5"
                    >
                        <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                </div>

                <div className="flex items-center justify-between gap-2 mb-5 relative z-10">
                    <button 
                        onClick={() => { setSelectionType('from'); setIsNetworkSheetOpen(true); }}
                        className="flex items-center gap-2 hover:bg-white/10 p-1.5 rounded-2xl transition-all active:scale-95 bg-white/5 border border-white/5 group/btn"
                    >
                        <TokenLogoDynamic 
                            logoUrl={fromToken?.iconUrl} 
                            alt={fromToken?.symbol || ''} 
                            size={24} 
                            chainId={fromToken?.chainId}
                            name={fromToken?.name}
                            symbol={fromToken?.symbol}
                        />
                        <div className="flex flex-col items-start leading-none pr-1">
                            <span className="text-[10px] font-black text-white uppercase">{fromToken?.symbol}</span>
                            <span className="text-[6px] text-muted-foreground font-bold uppercase tracking-tighter">Change</span>
                        </div>
                    </button>

                    <div className="flex-1 flex items-center justify-center relative px-2">
                        <div className="absolute inset-x-0 h-[1px] border-t border-dashed border-white/10" />
                        <div className="w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center relative z-10 shadow-lg group-hover:scale-110 transition-transform">
                            <Plane className="w-3 h-3 text-primary" />
                        </div>
                    </div>

                    <button 
                        onClick={() => { setSelectionType('to'); setIsNetworkSheetOpen(true); }}
                        className="flex items-center gap-2 text-right hover:bg-white/10 p-1.5 rounded-2xl transition-all active:scale-95 bg-white/5 border border-white/5 group/btn"
                    >
                        <div className="flex flex-col items-end leading-none pl-1">
                            <span className="text-[10px] font-black text-white uppercase">{toToken?.symbol}</span>
                            <span className="text-[6px] text-muted-foreground font-bold uppercase tracking-tighter">Change</span>
                        </div>
                        <TokenLogoDynamic 
                            logoUrl={toToken?.iconUrl} 
                            alt={toToken?.symbol || ''} 
                            size={24} 
                            chainId={toToken?.chainId}
                            name={toToken?.name}
                            symbol={toToken?.symbol}
                        />
                    </button>
                </div>

                <div className="flex items-center justify-between gap-6 px-1 relative z-10">
                    <div className="flex-1 min-w-0">
                        <p className="text-[7px] font-black text-muted-foreground uppercase mb-1.5 tracking-[0.2em] opacity-50">You Send</p>
                        <Input 
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-transparent border-none text-xl font-black p-0 h-auto focus-visible:ring-0 tracking-tighter text-white placeholder:text-zinc-800"
                        />
                    </div>
                    <div className="text-right">
                        <p className="text-[7px] font-black text-muted-foreground uppercase mb-1.5 tracking-[0.2em] opacity-50">You Receive</p>
                        {isQuoteLoading ? (
                            <Skeleton className="h-6 w-24 bg-white/5 rounded-lg ml-auto" />
                        ) : (
                            <div className={cn(
                                "text-xl font-black tracking-tighter transition-all tabular-nums",
                                quote ? "text-white" : "text-white/20"
                            )}>
                                {parseFloat(estimatedReceived).toFixed(4)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-[1px] bg-white/5 my-4" />

                <div className="flex items-center justify-between text-[7px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-5 relative z-10 px-1">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Timer className="w-3 h-3 text-primary/50" />
                            {isQuoteLoading ? <Skeleton className="h-2 w-8 bg-white/5" /> : <span>{executionTimeMin > 0 ? `${executionTimeMin}M` : '--'}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Fuel className="w-3 h-3 text-primary/50" />
                            {isQuoteLoading ? <Skeleton className="h-2 w-12 bg-white/5" /> : <span>${gasCostUsd.toFixed(2)} Fee</span>}
                        </div>
                    </div>
                    <span className="opacity-40">Slippage 0.5%</span>
                </div>

                <Button 
                    className={cn(
                        "w-full h-11 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl transition-all border-b-4 border-primary/40 active:border-b-0 active:translate-y-1",
                        !amount || isQuoteLoading || fetchError ? "bg-zinc-800 border-zinc-900 text-zinc-500 opacity-50 grayscale" : "bg-primary hover:bg-primary/90 shadow-primary/20"
                    )}
                    disabled={!amount || isQuoteLoading || !!fetchError}
                >
                    {isQuoteLoading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Finding Best Route...</span>
                        </div>
                    ) : fetchError ? (
                        "No Routes Found"
                    ) : (
                        "Quick Swap"
                    )}
                </Button>
            </div>
        </div>

        {/* NETWORK SELECTOR */}
        <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
            <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden z-[110]">
                <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-3xl -z-10" />
                <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />

                <div className="flex flex-col h-full relative z-10">
                    <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                    <SheetHeader className="mb-6 px-6 shrink-0 pt-4">
                        <SheetTitle className="text-2xl font-black text-center uppercase tracking-widest text-white">Target Network</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="flex-1 px-6 pb-12">
                        <div className="grid grid-cols-1 gap-2 pb-24">
                            {allChains.map((chain) => (
                                <button 
                                    key={chain.chainId}
                                    onClick={() => {
                                        setSelectedNetworkForSelection(chain);
                                        setIsTokenSideSheetOpen(true);
                                    }}
                                    style={{
                                        borderColor: `${chain.themeColor || '#818cf8'}40`,
                                        background: `linear-gradient(135deg, ${chain.themeColor || '#818cf8'}15 0%, rgba(0,0,0,0) 100%)`,
                                    }}
                                    className="flex items-center justify-between p-4 rounded-3xl border transition-all hover:bg-white/5 active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-4">
                                        <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={40} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                        <div className="text-left">
                                            <p className="font-black text-base text-white">{chain.name}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-mono opacity-60">ID: {chain.chainId}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </SheetContent>
        </Sheet>

        {/* TOKEN SELECTOR */}
        <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
            <SheetContent side="right" className="bg-[#050505]/95 backdrop-blur-2xl border-l border-white/5 w-full sm:max-w-[450px] p-0 flex flex-col h-full z-[120]">
                <SheetHeader className="p-6 border-b border-white/5 bg-gradient-to-b from-primary/10 to-transparent shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)} className="mb-4"><ArrowLeft className="w-5 h-5"/></Button>
                    <SheetTitle className="text-lg font-black uppercase tracking-tight text-white">{selectedNetworkForSelection?.name}</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-2 pb-20">
                        {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                            const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                            return (
                                <button 
                                    key={asset.symbol}
                                    onClick={() => handleTokenSelect(asset)}
                                    className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-4">
                                        <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.symbol} size={44} chainId={asset.chainId} symbol={asset.symbol} name={asset.name} />
                                        <div className="text-left leading-tight">
                                            <p className="font-bold text-base text-white">{asset.symbol}</p>
                                            <p className="text-xs text-muted-foreground">{asset.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-sm font-black text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    </>
  );
}
