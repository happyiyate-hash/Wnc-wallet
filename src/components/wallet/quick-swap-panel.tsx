'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from '@/contexts/wallet-provider';
import { 
  Plane, 
  Timer, 
  Fuel, 
  Loader2, 
  X, 
  Zap, 
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ShieldAlert
} from 'lucide-react';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '../ui/skeleton';

interface QuickSwapPanelProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function QuickSwapPanel({ isOpen, onOpenChange }: QuickSwapPanelProps) {
  const { allAssets, wallets, infuraApiKey, allChains, balances, allChainsMap, getAvailableAssetsForChain, prices } = useWallet();
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  useEffect(() => {
    if (isOpen && allAssets.length >= 2 && !fromToken) {
        const initialFrom = allAssets[0];
        const initialTo = allAssets.find(a => a.symbol !== initialFrom.symbol) || allAssets[1];
        setFromToken(initialFrom);
        setToToken(initialTo);
    }
  }, [isOpen, allAssets, fromToken]);

  // UNIFIED QUOTE ENGINE (SHARED WITH SWAP PAGE)
  useEffect(() => {
    const fetchQuickQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey) {
        setQuote(null);
        return;
      }
      
      setIsQuoteLoading(true);
      setFetchError(null);
      
      try {
        const sourceChainConfig = allChainsMap[fromToken.chainId];
        // Resolve correct source identity for the bridge/swap
        const sourceWallets = wallets?.filter(w => w.type === (sourceChainConfig.type || 'evm')) || [];
        const userAddr = sourceWallets[0]?.address || '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';

        const fromAddr = fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address;
        const toAddr = toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address;
        const fromDecimals = fromToken.decimals || 18;
        const formattedAmount = ethers.parseUnits(debouncedAmount, fromDecimals).toString();

        const params = new URLSearchParams({
          fromChain: fromToken.chainId.toString(),
          toChain: toToken.chainId.toString(),
          fromToken: fromAddr,
          toToken: toAddr,
          fromAmount: formattedAmount,
          fromAddress: userAddr,
          slippage: '0.005'
        });

        const res = await fetch(`/api/bridge/quote?${params.toString()}`);
        const data = await res.json();
        
        if (data.error || !data.estimate?.toAmount || data.estimate.toAmount === "0") {
            throw new Error(data.details || data.error || "No liquidity");
        }

        setQuote(data);
      } catch (e: any) {
        // INSTITUTIONAL FALLBACK (SHARED WITH SWAP PAGE)
        const fromPriceId = (fromToken.priceId || fromToken.coingeckoId || fromToken.address)?.toLowerCase();
        const toPriceId = (toToken.priceId || toToken.coingeckoId || toToken.address)?.toLowerCase();
        const fromPrice = fromPriceId ? prices[fromPriceId]?.price : 0;
        const toPrice = toPriceId ? prices[toPriceId]?.price : 0;

        if (fromPrice && toPrice) {
            const valIn = parseFloat(debouncedAmount);
            const rawOut = (valIn * fromPrice) / toPrice;
            const safeOut = rawOut * 0.97; // 3% safety discount
            
            setQuote({
                isFallback: true,
                tool: 'Market Estimate',
                estimate: {
                    toAmount: ethers.parseUnits(safeOut.toFixed(toToken.decimals || 18), toToken.decimals || 18).toString(),
                    executionDuration: 300,
                }
            });
        } else {
            setFetchError("Route unavailable.");
            setQuote(null);
        }
      } finally {
        setIsQuoteLoading(false);
      }
    };

    fetchQuickQuote();
  }, [debouncedAmount, fromToken, toToken, wallets, infuraApiKey, allChainsMap, prices]);

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
    setQuote(null); // Clear to trigger skeleton on pair change
  };

  const estimatedReceived = quote?.estimate?.toAmount 
    ? ethers.formatUnits(quote.estimate.toAmount, toToken?.decimals || 18) 
    : null;

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
                    boxShadow: `0 8px 40px -10px ${fromChainColor}60`,
                    borderColor: `${fromChainColor}40`,
                    backgroundColor: '#050505'
                }}
                className="border rounded-[2rem] p-3.5 max-w-lg mx-auto pointer-events-auto shadow-2xl relative overflow-hidden transition-all duration-500"
            >
                <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2 bg-primary/10 px-3 py-0.5 rounded-full border border-primary/20">
                        <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                        <span className="text-[7px] font-black uppercase tracking-[0.15em] text-primary">
                            {quote?.isFallback ? 'INSTITUTIONAL ESTIMATE' : `BEST ROUTE: ${quote?.tool?.toUpperCase() || 'SEARCHING AGGREGATORS...'}`}
                        </span>
                    </div>
                    <button onClick={() => onOpenChange(false)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                    <div className="flex-1 flex items-center bg-white/[0.03] border border-white/5 rounded-xl h-10 px-3 gap-2 group focus-within:border-primary/30 transition-all">
                        <button 
                            onClick={() => { setSelectionType('from'); setIsNetworkSheetOpen(true); }} 
                            className="shrink-0 active:scale-90 transition-all"
                        >
                            <TokenLogoDynamic 
                                logoUrl={fromToken?.iconUrl} 
                                alt={fromToken?.symbol || ''} 
                                size={22} 
                                chainId={fromToken?.chainId}
                                name={fromToken?.name}
                                symbol={fromToken?.symbol}
                            />
                        </button>
                        <Input 
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-transparent border-none text-xs font-black p-0 h-auto focus-visible:ring-0 text-white placeholder:text-zinc-800 tracking-tight"
                        />
                    </div>

                    <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shadow-xl">
                        <Plane className="w-3 h-3 text-primary" />
                    </div>

                    <div className="flex-1 flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl h-10 px-3 gap-2 overflow-hidden">
                        {isQuoteLoading && !quote ? (
                            <Skeleton className="h-3 w-16 bg-white/10 rounded" />
                        ) : (
                            <span className={cn(
                                "text-xs font-black tracking-tight tabular-nums truncate transition-all duration-300",
                                isQuoteLoading ? "opacity-40" : "opacity-100",
                                estimatedReceived ? "text-white" : "text-white/20"
                            )}>
                                {estimatedReceived ? parseFloat(estimatedReceived).toFixed(4) : '0.0000'}
                            </span>
                        )}
                        <button 
                            onClick={() => { setSelectionType('to'); setIsNetworkSheetOpen(true); }} 
                            className="shrink-0 active:scale-90 transition-all"
                        >
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

                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3 text-[8px] font-black uppercase text-muted-foreground/50">
                        <div className="flex items-center gap-1">
                            <Timer className="w-2.5 h-2.5 text-primary" />
                            <span>{quote?.estimate?.executionDuration ? `${Math.ceil(quote.estimate.executionDuration / 60)}M` : '--'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Fuel className="w-2.5 h-2.5 text-primary" />
                            <span>{quote?.estimate?.gasCosts?.[0] ? `$${parseFloat(quote.estimate.gasCosts[0].amountUsd || '0').toFixed(2)}` : '--'}</span>
                        </div>
                        {quote?.isFallback && (
                            <div className="flex items-center gap-1 text-primary/60">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                <span>3% Safety Buffer</span>
                            </div>
                        )}
                    </div>

                    <Button 
                        size="sm"
                        className={cn(
                            "h-7 px-4 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all shadow-lg active:scale-95",
                            !amount || isQuoteLoading || !!fetchError || !quote || quote?.isFallback ? "bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed grayscale" : "bg-primary hover:bg-primary/90 shadow-primary/20"
                        )}
                        disabled={!amount || isQuoteLoading || !!fetchError || !quote || quote?.isFallback}
                    >
                        {isQuoteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : quote?.isFallback ? "No Pool" : "Execute Swap"}
                    </Button>
                </div>
            </div>
        </div>

        <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
            <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3rem] p-0 h-[80vh] overflow-hidden z-[110]">
                <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl -z-10" />
                <div className="flex flex-col h-full relative z-10">
                    <div className="w-12 h-1 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                    <SheetHeader className="mb-6 px-6 shrink-0">
                        <SheetTitle className="sr-only">Select Network</SheetTitle>
                        <div className="text-xl font-black text-center uppercase tracking-widest text-white">Select Network</div>
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

        <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
            <SheetContent side="right" className="bg-black/95 backdrop-blur-2xl border-l border-white/5 w-full sm:max-w-[400px] p-0 flex flex-col h-full z-[120]">
                <SheetHeader className="p-6 border-b border-white/5 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)} className="mb-4">
                        <ArrowLeft className="w-5 h-5"/>
                    </Button>
                    <SheetTitle className="sr-only">Select Token</SheetTitle>
                    <div className="text-lg font-black uppercase tracking-tight text-white">{selectedNetworkForSelection?.name}</div>
                </SheetHeader>
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-2 pb-20">
                        {selectedNetworkForSelection && getAvailableAssetsForChain(selectedNetworkForSelection.chainId).map((token) => {
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
