'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from '@/contexts/wallet-provider';
import { Plane, Timer, Fuel, Loader2, X, ChevronRight, ArrowLeft, Zap, ShieldCheck } from 'lucide-react';
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
  const { allAssets, viewingNetwork, wallets, infuraApiKey, allChains, balances, allChainsMap } = useWallet();
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

  const fromChainColor = fromToken ? (allChainsMap[fromToken.chainId]?.themeColor || '#818cf8') : '#818cf8';

  return (
    <>
        <div 
            className={cn(
                "fixed top-3 left-2 right-2 z-[100] transition-all duration-500 ease-in-out pointer-events-none",
                isOpen ? "translate-y-0 opacity-100" : "-translate-y-[150%] opacity-0"
            )}
        >
            <div 
                style={{ 
                    borderColor: `${fromChainColor}40`,
                    boxShadow: `0 20px 50px -12px ${fromChainColor}30`
                }}
                className="bg-black/90 backdrop-blur-3xl border rounded-[1.5rem] p-3 max-w-lg mx-auto pointer-events-auto relative overflow-hidden"
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                        <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">Best Price Found: LI.FI Aggregator</span>
                    </div>
                    <button 
                        onClick={() => onOpenChange(false)}
                        className="p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
                    <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
                        <button onClick={() => { setSelectionType('from'); setIsNetworkSheetOpen(true); }} className="shrink-0 active:scale-90 transition-transform">
                            <TokenLogoDynamic 
                                logoUrl={fromToken?.iconUrl} 
                                alt={fromToken?.symbol || ''} 
                                size={22} 
                                chainId={fromToken?.chainId}
                                name={fromToken?.name}
                                symbol={fromToken?.symbol}
                            />
                        </button>
                        <div className="flex-1 min-w-0">
                            <Input 
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="bg-transparent border-none text-sm font-black p-0 h-auto focus-visible:ring-0 tracking-tighter text-white placeholder:text-zinc-800"
                            />
                        </div>
                    </div>

                    <div className="w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shadow-lg">
                        <Plane className="w-3 h-3 text-primary" />
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5 text-right">
                        <div className="flex-1 min-w-0">
                            {isQuoteLoading ? (
                                <Skeleton className="h-4 w-12 bg-white/10 rounded ml-auto" />
                            ) : (
                                <span className={cn(
                                    "text-sm font-black tracking-tighter tabular-nums block truncate",
                                    quote ? "text-white" : "text-white/20"
                                )}>
                                    {parseFloat(estimatedReceived).toFixed(4)}
                                </span>
                            )}
                        </div>
                        <button onClick={() => { setSelectionType('to'); setIsNetworkSheetOpen(true); }} className="shrink-0 active:scale-90 transition-transform">
                            <TokenLogoDynamic 
                                logoUrl={toToken?.iconUrl} 
                                alt={toToken?.symbol || ''} 
                                size={22} 
                                chainId={toToken?.chainId}
                                name={toToken?.name}
                                symbol={toToken?.symbol}
                            />
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-[7px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 px-1">
                        <div className="flex items-center gap-1">
                            <Timer className="w-2.5 h-2.5" />
                            <span>{quote?.estimate?.executionDuration ? `${Math.ceil(quote.estimate.executionDuration / 60)}M` : '--'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Fuel className="w-2.5 h-2.5" />
                            <span>{quote ? `$${(quote.estimate.gasCosts?.[0]?.amountUsd || 0).toFixed(2)}` : '--'}</span>
                        </div>
                    </div>

                    <Button 
                        size="sm"
                        className={cn(
                            "h-7 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                            !amount || isQuoteLoading || fetchError ? "bg-zinc-800 text-zinc-500 opacity-50" : "bg-primary hover:bg-primary/90"
                        )}
                        disabled={!amount || isQuoteLoading || !!fetchError}
                    >
                        {isQuoteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Execute Swap"}
                    </Button>
                </div>
            </div>
        </div>

        {/* NETWORK SELECTOR */}
        <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
            <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3rem] p-0 h-[80vh] overflow-hidden z-[110]">
                <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl -z-10" />
                <div className="flex flex-col h-full relative z-10">
                    <div className="w-12 h-1 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                    <SheetHeader className="mb-6 px-6 shrink-0">
                        <SheetTitle className="text-xl font-black text-center uppercase tracking-widest text-white">Target Network</SheetTitle>
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
                                    className="flex items-center justify-between p-3.5 rounded-2xl border transition-all hover:bg-white/5 active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={32} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                        <div className="text-left leading-tight">
                                            <p className="font-black text-sm text-white">{chain.name}</p>
                                            <p className="text-[8px] text-muted-foreground uppercase font-mono opacity-60">ID: {chain.chainId}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </SheetContent>
        </Sheet>

        {/* TOKEN SELECTOR */}
        <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
            <SheetContent side="right" className="bg-black/95 backdrop-blur-2xl border-l border-white/5 w-full sm:max-w-[400px] p-0 flex flex-col h-full z-[120]">
                <SheetHeader className="p-6 border-b border-white/5 shrink-0">
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
                                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.symbol} size={36} chainId={asset.chainId} symbol={asset.symbol} name={asset.name} />
                                        <div className="text-left leading-tight">
                                            <p className="font-bold text-sm text-white">{asset.symbol}</p>
                                            <p className="text-[10px] text-muted-foreground">{asset.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-xs font-black text-white">{parseFloat(asset.balance).toFixed(4)}</p>
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
