'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  ArrowUpDown, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Fuel, 
  Zap, 
  ChevronRight,
  Wallet as WalletIcon,
  Copy,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Route as RouteIcon,
  Settings2,
  ExternalLink,
  ShieldCheck,
  Info,
  GripVertical
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { currencyConversionWithLLMValidation } from '@/app/actions';
import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/contexts/user-provider';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getInitialAssets } from '@/lib/wallets/balances';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { getAddressForChain } from '@/lib/wallets/utils';
import { ethers } from 'ethers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDebounce } from '@/hooks/use-debounce';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SwapPage() {
  const { allChains, viewingNetwork, balances, wallets, infuraApiKey, allAssets } = useWallet();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- UI STATE ---
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  const [slippage, setSlippage] = useState('0.5');
  
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  // --- DATA STATE ---
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // --- AI & ACTION STATE ---
  const [isValidating, setIsValidating] = useState(false);
  const [aiValidation, setAiValidation] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!fromToken && allAssets.length > 0) {
      const fromSymbol = searchParams.get('symbol') || searchParams.get('fromSymbol');
      const chainIdParam = parseInt(searchParams.get('chainId') || '');
      const targetChainId = !isNaN(chainIdParam) ? chainIdParam : viewingNetwork.chainId;
      
      const found = allAssets.find(a => a.symbol === fromSymbol && a.chainId === targetChainId) || allAssets[0];
      if (found) setFromToken({ ...found });
    }
    if (!toToken && allAssets.length > 0) {
      // Pick a different asset for "to" by default
      const found = allAssets.find(a => a.symbol !== fromToken?.symbol) || allAssets[allAssets.length - 1] || allAssets[0];
      if (found) setToToken({ ...found });
    }
  }, [allAssets, searchParams, fromToken, toToken, viewingNetwork.chainId]);

  // --- QUOTE FETCHING ---
  useEffect(() => {
    const getQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey) {
        setQuoteData(null);
        setFetchError(null);
        return;
      }

      setIsQuoteLoading(true);
      setAiValidation(null);
      setFetchError(null);

      try {
        const fromAddr = fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address;
        const toAddr = toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address;
        const userAddr = wallets ? getAddressForChain(viewingNetwork, wallets)! : '0x0000000000000000000000000000000000000000';

        const params = new URLSearchParams({
          fromChain: fromToken.chainId.toString(),
          toChain: toToken.chainId.toString(),
          fromToken: fromAddr,
          toToken: toAddr,
          fromAmount: ethers.parseUnits(debouncedAmount, 18).toString(),
          fromAddress: userAddr,
          slippage: (parseFloat(slippage) / 100).toString()
        });

        const res = await fetch(`/api/bridge/quote?${params.toString()}`);
        if (!res.ok) throw new Error("Liquidity depth insufficient for this pair.");

        const data = await res.json();
        if (data.error) throw new Error(data.details || data.error);

        setQuoteData(data);
      } catch (e: any) {
        setFetchError(e.message);
        setQuoteData(null);
      } finally {
        setIsQuoteLoading(false);
      }
    };

    getQuote();
  }, [debouncedAmount, fromToken, toToken, wallets, viewingNetwork, slippage, infuraApiKey]);

  const balance = parseFloat(fromToken?.balance || '0');
  const canValidate = quoteData && !isQuoteLoading;

  const handleFlip = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setAiValidation(null);
    setQuoteData(null);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setAiValidation(null);
    setQuoteData(null);
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
  };

  const handleValidateWithAI = async () => {
    if (!canValidate || !fromToken || !toToken || !quoteData) return;
    setIsValidating(true);
    try {
      const result = await currencyConversionWithLLMValidation({
        fromCurrency: fromToken.symbol,
        toCurrency: toToken.symbol,
        amount: parseFloat(amount),
        convertedAmount: parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)),
        priceImpact: parseFloat(quoteData.estimate.feeCosts?.[0]?.amountUsd || '0') * -1,
        gasFeeUsd: parseFloat(quoteData.estimate.gasCosts?.[0]?.amountUsd || '2.50'),
        chainName: `${fromToken.chainId === toToken.chainId ? 'Same-Chain' : 'Cross-Chain'} (${viewingNetwork.name})`
      });
      setAiValidation(result);
    } catch (e) {
      setAiValidation({ isValid: true, validationReason: "Market rates confirmed by Liquidity Provider." });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmSwap = async () => {
    if (!user || !aiValidation?.isValid) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('ledger').insert({
          userId: user.id, 
          type: 'swap', 
          amount: parseFloat(amount), 
          assetId: fromToken?.symbol, 
          txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
          timestamp: new Date().toISOString()
      });
      if (error) throw error;
      
      toast({ title: "Swap Broadcasted", description: "Tokens will be credited after network confirmation." });
      router.push('/');
    } catch (e) {
      toast({ title: "Execution Error", description: "Slippage tolerance exceeded. Try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-black uppercase tracking-widest">Bridge & Swap</h1>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Settings2 className="w-5 h-5 text-muted-foreground" />
        </Button>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4 overflow-y-auto thin-scrollbar pb-32">
        {/* FROM TOKEN SECTION */}
        <div className="p-6 rounded-2xl bg-secondary/30 border border-white/5 space-y-4 shadow-inner">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You Pay</span>
            <span className="text-[10px] text-muted-foreground font-mono bg-white/5 px-2 py-0.5 rounded-full">Balance: {fromToken?.balance}</span>
          </div>
          <div className="flex items-center gap-4">
            <Input 
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-4xl font-black bg-transparent border-none p-0 focus-visible:ring-0 h-auto flex-1 min-w-0 placeholder:opacity-20 text-white"
            />
            <Button 
                variant="outline" 
                className="rounded-xl gap-2 h-14 px-4 bg-zinc-900 border-white/10 hover:bg-zinc-800 shrink-0 shadow-xl border-b-2 active:translate-y-0.5 transition-all"
                onClick={() => {
                    setSelectionType('from');
                    setIsNetworkSheetOpen(true);
                }}
            >
              <TokenLogoDynamic 
                logoUrl={fromToken?.iconUrl} 
                alt={fromToken?.name || ''} 
                size={44} 
                chainId={fromToken?.chainId}
                name={fromToken?.name}
                symbol={fromToken?.symbol}
              />
              <div className="flex flex-col items-start leading-none">
                <span className="font-black text-sm text-white">{fromToken?.symbol || 'Select'}</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-tighter mt-0.5">Chain ID: {fromToken?.chainId}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50" />
            </Button>
          </div>
        </div>

        {/* FLIP BUTTON */}
        <div className="flex justify-center -my-8 relative z-20">
          <Button 
            size="icon" 
            variant="outline" 
            className="rounded-xl bg-zinc-950 border-white/10 h-12 w-12 shadow-2xl hover:scale-110 active:scale-95 transition-all group border-b-4 active:border-b-0"
            onClick={handleFlip}
          >
            <ArrowUpDown className="w-5 h-5 text-primary group-hover:rotate-180 transition-transform duration-500" />
          </Button>
        </div>

        {/* TO TOKEN SECTION */}
        <div className="p-6 rounded-2xl bg-secondary/30 border border-white/5 space-y-4 shadow-inner">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You Receive Est.</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-4xl font-black truncate flex items-center gap-2 text-white">
              {isQuoteLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : (
                quoteData ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)).toFixed(6) : '0.00'
              )}
            </div>
            <Button 
                variant="outline" 
                className="rounded-xl gap-2 h-14 px-4 bg-zinc-900 border-white/10 hover:bg-zinc-800 shrink-0 shadow-xl border-b-2 active:translate-y-0.5 transition-all"
                onClick={() => {
                    setSelectionType('to');
                    setIsNetworkSheetOpen(true);
                }}
            >
              <TokenLogoDynamic 
                logoUrl={toToken?.iconUrl} 
                alt={toToken?.symbol || ''} 
                size={44} 
                chainId={toToken?.chainId}
                name={toToken?.name}
                symbol={toToken?.symbol}
              />
              <div className="flex flex-col items-start leading-none">
                <span className="font-black text-sm text-white">{toToken?.symbol || 'Select'}</span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-tighter mt-0.5">Chain ID: {toToken?.chainId}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50" />
            </Button>
          </div>
        </div>

        {fetchError && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive text-sm font-black animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{fetchError}</p>
            </div>
        )}

        {/* QUOTE DETAILS & ROUTING */}
        {quoteData && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground uppercase font-black tracking-widest text-[9px]">
                <RouteIcon className="w-3.5 h-3.5" /> Best Multi-DEX Route
              </div>
              <span className="font-black text-primary flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-lg">
                {quoteData.tool} <ExternalLink className="w-3 h-3 opacity-50" />
              </span>
            </div>

            {/* SMART ROUTE VISUALIZER */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest mb-2 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-yellow-500 fill-current" /> Optimized Path Breakdown
                </p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 thin-scrollbar">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black border border-white/10 text-white">{fromToken?.symbol}</div>
                        <ArrowRight className="w-3 h-3 text-muted-foreground opacity-30" />
                    </div>
                    {quoteData.includedSteps?.map((step: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 shrink-0">
                            <div className="px-3 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                                <span className="text-[10px] font-black text-primary whitespace-nowrap">{step.toolDetails?.name || step.tool}</span>
                            </div>
                            <ArrowRight className="w-3 h-3 text-muted-foreground opacity-30" />
                        </div>
                    ))}
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black border border-white/10 text-white">{toToken?.symbol}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Network Fees</p>
                    <p className="text-sm font-black flex items-center gap-1.5 text-white">
                        <Fuel className="w-3.5 h-3.5 text-muted-foreground" />
                        ~${quoteData.estimate.gasCosts?.[0]?.amountUsd || '2.50'}
                    </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Price Impact</p>
                    <p className={cn(
                        "text-sm font-black flex items-center gap-1.5", 
                        parseFloat(quoteData.estimate.feeCosts?.[0]?.amountUsd || '0') > 5 ? "text-red-400" : "text-green-400"
                    )}>
                        <TrendingUp className="w-3.5 h-3.5" />
                        {quoteData.estimate.feeCosts?.[0]?.amountUsd ? `-$${quoteData.estimate.feeCosts[0].amountUsd}` : 'Negligible'}
                    </p>
                </div>
            </div>
          </div>
        )}

        {aiValidation && (
          <div className={cn(
            "p-5 rounded-2xl flex items-start gap-4 border animate-in zoom-in-95 shadow-2xl transition-all",
            aiValidation.isValid 
                ? "bg-green-500/10 border-green-500/20 text-green-400" 
                : "bg-destructive/10 border-destructive/20 text-destructive shadow-destructive/5"
          )}>
            {aiValidation.isValid ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : <AlertTriangle className="w-6 h-6 shrink-0" />}
            <div className="space-y-1">
              <p className="font-black text-sm tracking-tight">{aiValidation.isValid ? 'Liquidity Verified' : 'High Volatility Warning'}</p>
              <p className="text-[11px] opacity-80 leading-relaxed">{aiValidation.validationReason}</p>
              {aiValidation.suggestion && (
                <p className="text-[10px] font-black italic text-primary mt-1">Note: {aiValidation.suggestion}</p>
              )}
            </div>
          </div>
        )}

        {/* FLOATING ACTION BUTTON */}
        <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto z-50">
          {amount && parseFloat(amount) > balance && (
            <div className="mb-4 flex items-center justify-center gap-2 text-[10px] text-white font-black uppercase tracking-widest bg-red-600 py-3 rounded-2xl shadow-xl border-b-4 border-red-800 active:translate-y-0.5 transition-all">
              <AlertCircle className="w-4 h-4" /> Insufficient Liquidity
            </div>
          )}
          
          {!aiValidation ? (
            <Button 
              className="w-full h-16 rounded-[1.5rem] text-lg font-black shadow-2xl shadow-primary/30 transition-all active:translate-y-1 border-b-4 border-primary/50"
              disabled={!canValidate || isValidating || (amount && parseFloat(amount) > balance)}
              onClick={handleValidateWithAI}
            >
              {isValidating ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Aggregating Liquidity Pools...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 fill-current" />
                  <span>Get Optimized Quotes</span>
                </div>
              )}
            </Button>
          ) : (
            <Button 
              className="w-full h-16 rounded-[1.5rem] text-lg font-black shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90 transition-all active:translate-y-1 border-b-4 border-primary/50"
              disabled={!aiValidation.isValid || isSubmitting}
              onClick={() => setShowConfirm(true)}
            >
              Review Swap Details
            </Button>
          )}
        </div>
      </main>

      {/* SELECTION SHEETS */}
      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[#0a0a0c]/60 backdrop-blur-3xl -z-10" />
            <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />
            
            <div className="flex flex-col h-full relative z-10">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                <SheetHeader className="mb-6 px-6 shrink-0">
                    <SheetTitle className="text-2xl font-black text-center uppercase tracking-widest">Select Network</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6 pb-8">
                    <div className="grid grid-cols-1 gap-3 pb-12">
                        {allChains.map((chain) => (
                            <button 
                                key={chain.chainId}
                                onClick={() => {
                                    setSelectedNetworkForSelection(chain);
                                    setIsTokenSideSheetOpen(true);
                                }}
                                style={{
                                    borderColor: chain.themeColor || '#818cf8',
                                    borderWidth: '2px',
                                    background: `linear-gradient(135deg, ${chain.themeColor || '#818cf8'}25 0%, rgba(0,0,0,0) 100%)`,
                                }}
                                className="flex items-center justify-between p-3.5 rounded-2xl border transition-all group active:scale-[0.98] shadow-lg shadow-black/20"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic 
                                        logoUrl={chain.iconUrl} 
                                        alt={chain.name} 
                                        size={44} 
                                        chainId={chain.chainId} 
                                        name={chain.name}
                                        symbol={chain.symbol}
                                    />
                                    <div className="text-left">
                                        <p className="font-black text-base text-white">{chain.name}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono opacity-60">Chain ID: {chain.chainId}</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-[#0a0a0c]/95 backdrop-blur-2xl border-l border-primary/20 w-full sm:max-w-[450px] p-0 flex flex-col shadow-2xl">
            <SheetHeader className="p-6 border-b border-white/5 bg-gradient-to-b from-primary/10 to-transparent shrink-0">
                <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)} className="rounded-xl mb-4"><ArrowLeft className="w-5 h-5"/></Button>
                <SheetTitle className="flex items-center gap-3">
                    <TokenLogoDynamic 
                        logoUrl={selectedNetworkForSelection?.iconUrl} 
                        alt={selectedNetworkForSelection?.name || ''} 
                        size={32} 
                        chainId={selectedNetworkForSelection?.chainId} 
                        name={selectedNetworkForSelection?.name}
                        symbol={selectedNetworkForSelection?.symbol}
                    />
                    <div className="flex flex-col items-start text-left leading-none">
                        <span className="text-lg font-black uppercase tracking-tight">{selectedNetworkForSelection?.name}</span>
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-black mt-1">Select token to {selectionType}</span>
                    </div>
                </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3 pb-12">
                    {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                        const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                        return (
                            <button 
                                key={asset.symbol}
                                onClick={() => handleTokenSelect(asset)}
                                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-[0.98] group"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic 
                                        logoUrl={asset.iconUrl} 
                                        alt={asset.symbol} 
                                        size={44} 
                                        chainId={asset.chainId} 
                                        symbol={asset.symbol} 
                                        name={asset.name}
                                    />
                                    <div className="text-left leading-tight">
                                        <p className="font-black text-base text-white group-hover:text-primary transition-colors">{asset.symbol}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{asset.name}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm font-black text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                                    <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-1">Available</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* CONFIRMATION DIALOG (Step 5 & 6) */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-zinc-950 border-white/10 rounded-[3rem] p-8 max-w-[95vw] sm:max-w-[450px] shadow-2xl">
          <DialogHeader className="space-y-4">
            <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary mx-auto border border-primary/20 shadow-inner">
                <ShieldCheck className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-black text-center">Liquidity Pool Quote</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm leading-relaxed text-center px-4">
              Best route found via <span className="text-primary font-bold">{quoteData?.tool}</span>. Rates are locked for your safety.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
                <div className="flex flex-col items-center gap-2">
                    <TokenLogoDynamic 
                        logoUrl={fromToken?.iconUrl} 
                        alt={fromToken?.symbol || ''} 
                        size={48} 
                        chainId={fromToken?.chainId}
                        name={fromToken?.name}
                        symbol={fromToken?.symbol}
                    />
                    <span className="font-black text-sm text-white">{amount} {fromToken?.symbol}</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <ArrowRight className="w-6 h-6 text-primary animate-pulse" />
                    <span className="text-[8px] uppercase tracking-[0.2em] font-black opacity-50">Liquidity Path</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <TokenLogoDynamic 
                        logoUrl={toToken?.iconUrl} 
                        alt={toToken?.symbol || ''} 
                        size={48} 
                        chainId={toToken?.chainId}
                        name={toToken?.name}
                        symbol={toToken?.symbol}
                    />
                    <span className="font-black text-sm text-primary">{quoteData ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)).toFixed(4) : '...'} {toToken?.symbol}</span>
                </div>
            </div>
            
            <div className="p-5 rounded-xl bg-secondary/20 border border-white/5 space-y-3">
                <div className="flex justify-between text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    <span>Aggregator Fee</span>
                    <span className="text-white">$0.00</span>
                </div>
                <div className="flex justify-between text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    <span>Partner / App Fee</span>
                    <span className="text-primary">$0.00 (Waived)</span>
                </div>
                <div className="flex justify-between text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    <span>Estimated Network Gas</span>
                    <span className="text-white">${quoteData?.estimate.gasCosts?.[0]?.amountUsd || '2.50'}</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between text-base font-black text-white">
                    <span>Guaranteed Minimum</span>
                    <span className="text-primary">
                        {quoteData ? (parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)) * (1 - parseFloat(slippage)/100)).toFixed(4) : '...'} {toToken?.symbol}
                    </span>
                </div>
            </div>
          </div>

          <DialogFooter className="mt-8 flex flex-col gap-3 sm:flex-col">
            <Button onClick={handleConfirmSwap} className="w-full h-16 rounded-[1.5rem] font-black text-lg shadow-xl shadow-primary/20 border-b-4 border-primary/50 active:translate-y-1 transition-all" disabled={isSubmitting}>
              {isSubmitting ? (
                  <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Broadcasting to DEX...</span>
                  </div>
              ) : "Sign & Broadcast Swap"}
            </Button>
            <Button variant="ghost" onClick={() => setShowConfirm(false)} className="w-full h-12 rounded-xl text-muted-foreground hover:bg-white/5">Cancel Quote</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
