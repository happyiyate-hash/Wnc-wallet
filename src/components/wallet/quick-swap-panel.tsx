
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

interface QuickSwapPanelProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function QuickSwapPanel({ isOpen, onOpenChange }: QuickSwapPanelProps) {
  const { allAssets, viewingNetwork, wallets, infuraApiKey, allChains, balances } = useWallet();
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 500);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);

  // Selection Sheets State
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  useEffect(() => {
    if (allAssets.length >= 2 && !fromToken) {
        setFromToken(allAssets[0]);
        setToToken(allAssets[1]);
    }
  }, [allAssets, fromToken]);

  useEffect(() => {
    const fetchQuickQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey) {
        setQuote(null);
        return;
      }
      setIsQuoteLoading(true);
      try {
        const fromAddr = fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address;
        const toAddr = toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address;
        const params = new URLSearchParams({
          fromChain: fromToken.chainId.toString(),
          toChain: toToken.chainId.toString(),
          fromToken: fromAddr,
          toToken: toAddr,
          fromAmount: ethers.parseUnits(debouncedAmount, 18).toString(),
          fromAddress: wallets?.[0]?.address || '',
          slippage: '0.005'
        });
        const res = await fetch(`/api/bridge/quote?${params.toString()}`);
        const data = await res.json();
        setQuote(data);
      } catch (e) {
        console.error("Quick swap quote failed", e);
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
  };

  const estimatedReceived = quote?.estimate?.toAmount 
    ? ethers.formatUnits(quote.estimate.toAmount, 18) 
    : '0';

  return (
    <>
        <div 
            className={cn(
                "fixed top-4 left-4 right-4 z-[100] transition-all duration-500 ease-in-out pointer-events-none",
                isOpen ? "translate-y-0 opacity-100" : "-translate-y-[120%] opacity-0"
            )}
        >
            <div className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 max-w-sm mx-auto pointer-events-auto relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/80">Institutional Quick Exchange</span>
                    <button 
                        onClick={() => onOpenChange(false)}
                        className="p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                </div>

                <div className="flex items-center justify-between gap-2 mb-4">
                    <button 
                        onClick={() => { setSelectionType('from'); setIsNetworkSheetOpen(true); }}
                        className="flex items-center gap-2 hover:bg-white/5 p-1 rounded-xl transition-all active:scale-95"
                    >
                        <TokenLogoDynamic 
                            logoUrl={fromToken?.iconUrl} 
                            alt={fromToken?.symbol || ''} 
                            size={24} 
                            chainId={fromToken?.chainId}
                            name={fromToken?.name}
                            symbol={fromToken?.symbol}
                        />
                        <span className="text-[10px] font-black text-white uppercase">{fromToken?.symbol}</span>
                    </button>

                    <div className="flex-1 flex items-center justify-center relative">
                        <div className="absolute inset-x-0 h-[1px] border-t border-dashed border-white/5" />
                        <Plane className="w-3 h-3 text-primary relative z-10" />
                    </div>

                    <button 
                        onClick={() => { setSelectionType('to'); setIsNetworkSheetOpen(true); }}
                        className="flex items-center gap-2 text-right hover:bg-white/5 p-1 rounded-xl transition-all active:scale-95"
                    >
                        <span className="text-[10px] font-black text-white uppercase">{toToken?.symbol}</span>
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

                <div className="flex items-center justify-between gap-4 px-1">
                    <div className="flex-1 min-w-0">
                        <p className="text-[7px] font-black text-muted-foreground uppercase mb-1 tracking-widest">Amount</p>
                        <Input 
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-transparent border-none text-lg font-black p-0 h-auto focus-visible:ring-0 tracking-tighter text-white placeholder:text-zinc-800"
                        />
                    </div>
                    <div className="text-right">
                        <p className="text-[7px] font-black text-muted-foreground uppercase mb-1 tracking-widest">Receive</p>
                        <div className="text-lg font-black text-white/40 tracking-tighter transition-all tabular-nums">
                            {isQuoteLoading ? <Loader2 className="w-4 h-4 animate-spin inline-block" /> : parseFloat(estimatedReceived).toFixed(4)}
                        </div>
                    </div>
                </div>

                <div className="h-[1px] bg-white/5 my-3" />

                <div className="flex items-center justify-between text-[7px] font-black uppercase tracking-[0.1em] text-muted-foreground/40 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <Timer className="w-2.5 h-2.5 text-primary/50" />
                            <span>{Math.ceil((quote?.estimate?.executionDuration || 300) / 60)}m</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Fuel className="w-2.5 h-2.5 text-primary/50" />
                            <span>0% Fee</span>
                        </div>
                    </div>
                    <span>Slippage 0.5%</span>
                </div>

                <Button 
                    className="w-full h-9 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/10 active:scale-[0.98] transition-all bg-primary"
                    disabled={!amount || isQuoteLoading}
                >
                    {isQuoteLoading ? "Fetching..." : "Quick Swap"}
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
