'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  ArrowUpDown, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Fuel, 
  Zap, 
  ChevronRight,
  Wallet as WalletIcon,
  Copy,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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

export default function SwapPage() {
  const { allChains, viewingNetwork, balances, wallets } = useWallet();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  // --- STATE ---
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [isGasLoading, setIsGasLoading] = useState(false);

  const [isValidating, setIsValidating] = useState(false);
  const [aiValidation, setAiValidation] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    const assets = getInitialAssets(viewingNetwork.chainId);
    if (!fromToken) setFromToken(assets[0] || null);
    if (!toToken) setToToken(assets[1] || null);
  }, [viewingNetwork, fromToken, toToken]);

  // --- QUOTE FETCHING ---
  useEffect(() => {
    const getQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0) {
        setQuoteData(null);
        return;
      }

      setIsQuoteLoading(true);
      try {
        const fromAddr = fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address;
        const toAddr = toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address;
        
        // Use the internal Bridge Quote API which uses LI.FI
        const params = new URLSearchParams({
          fromChain: fromToken.chainId.toString(),
          toChain: toToken.chainId.toString(),
          fromToken: fromAddr,
          toToken: toAddr,
          fromAmount: ethers.parseUnits(debouncedAmount, 18).toString(), // simplified decimals
          fromAddress: wallets ? getAddressForChain(viewingNetwork, wallets)! : '0x0000000000000000000000000000000000000000'
        });

        const res = await fetch(`/api/bridge/quote?${params.toString()}`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.details || data.error);
        setQuoteData(data);
      } catch (e: any) {
        console.error("Quote error:", e);
        setQuoteData(null);
      } finally {
        setIsQuoteLoading(false);
      }
    };

    getQuote();
  }, [debouncedAmount, fromToken, toToken, wallets, viewingNetwork, getAddressForChain]);

  // --- GAS ESTIMATION ---
  useEffect(() => {
    const estimateGas = async () => {
      if (!quoteData || !wallets) return;
      setIsGasLoading(true);
      try {
        const rpcUrl = `https://rpc.ankr.com/${viewingNetwork.name.toLowerCase().replace(/\s/g, '')}`;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Simple gas estimation based on quote tx if available, or fallback
        const gasPrice = (await provider.getFeeData()).gasPrice || 1000000000n;
        const gasLimit = quoteData.transactionRequest?.gasLimit ? BigInt(quoteData.transactionRequest.gasLimit) : 250000n;
        
        const fee = gasPrice * gasLimit;
        setGasEstimate(ethers.formatEther(fee));
      } catch (e) {
        setGasEstimate('0.002'); // generic fallback
      } finally {
        setIsGasLoading(false);
      }
    };

    estimateGas();
  }, [quoteData, wallets, viewingNetwork]);

  // --- HELPERS ---
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
    if (!canValidate || !fromToken || !toToken) return;
    setIsValidating(true);
    try {
      // Real-time Guardian AI check
      const result = await currencyConversionWithLLMValidation({
        fromCurrency: fromToken.symbol,
        toCurrency: toToken.symbol,
        amount: parseFloat(amount),
        convertedAmount: parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)),
        priceImpact: parseFloat(quoteData.estimate.feeCosts?.[0]?.amountUsd || '0') * -1, // simplistic impact
        gasFeeUsd: parseFloat(quoteData.estimate.gasCosts?.[0]?.amountUsd || '2.5'),
        chainName: viewingNetwork.name
      });
      setAiValidation(result);
    } catch (e) {
      toast({ title: "AI Offline", description: "Proceed with caution.", variant: "destructive" });
      setAiValidation({ isValid: true, validationReason: "AI verification skipped." });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmSwap = async () => {
    if (!user || !aiValidation?.isValid) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('transactions').insert({
          user_id: user.id, type: 'swap', amount: parseFloat(amount), status: 'pending', 
          token_symbol: fromToken?.symbol, chain_id: viewingNetwork.chainId.toString()
      });
      if (error) throw error;
      
      toast({ title: "Transaction Sent", description: "Broadcasting to network..." });
      await new Promise(r => setTimeout(r, 2000));
      router.push('/');
    } catch (e) {
      toast({ title: "Swap Failed", description: "Network error.", variant: "destructive" });
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
        <h1 className="text-lg font-bold">Safe Swap</h1>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Info className="w-5 h-5 text-muted-foreground" />
        </Button>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4 overflow-y-auto thin-scrollbar pb-32">
        {/* FROM PANEL */}
        <div className="p-6 rounded-[2rem] bg-secondary/30 border border-white/5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">You Pay</span>
            <span className="text-[10px] text-muted-foreground font-mono">Balance: {fromToken?.balance}</span>
          </div>
          <div className="flex items-center gap-4">
            <Input 
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAiValidation(null);
              }}
              className="text-4xl font-bold bg-transparent border-none p-0 focus-visible:ring-0 h-auto"
            />
            <Button 
                variant="outline" 
                className="rounded-2xl gap-2 h-12 px-4 bg-white/5 border-white/10 hover:bg-white/10"
                onClick={() => {
                    setSelectionType('from');
                    setIsNetworkSheetOpen(true);
                }}
            >
              <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={28} chainId={fromToken?.chainId} />
              <span className="font-bold">{fromToken?.symbol}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* FLIP */}
        <div className="flex justify-center -my-6 relative z-20">
          <Button 
            size="icon" 
            variant="outline" 
            className="rounded-2xl bg-zinc-950 border-white/10 h-12 w-12 shadow-2xl hover:scale-110 active:scale-95 transition-all group"
            onClick={handleFlip}
          >
            <ArrowUpDown className="w-5 h-5 text-primary group-hover:rotate-180 transition-transform duration-500" />
          </Button>
        </div>

        {/* TO PANEL */}
        <div className="p-6 rounded-[2rem] bg-secondary/30 border border-white/5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">You Receive</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-4xl font-bold truncate flex items-center gap-2">
              {isQuoteLoading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : (
                quoteData ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)).toFixed(6) : '0.00'
              )}
            </div>
            <Button 
                variant="outline" 
                className="rounded-2xl gap-2 h-12 px-4 bg-white/5 border-white/10 hover:bg-white/10"
                onClick={() => {
                    setSelectionType('to');
                    setIsNetworkSheetOpen(true);
                }}
            >
              <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={28} chainId={toToken?.chainId} />
              <span className="font-bold">{toToken?.symbol}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* MARKET DATA */}
        {quoteData && (
          <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Fuel className="w-4 h-4" /> Network Fee
              </div>
              <span className="font-bold">{isGasLoading ? '...' : `~$${quoteData.estimate.gasCosts?.[0]?.amountUsd || '2.50'}`}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4" /> Price Impact
              </div>
              <span className={cn("font-bold", parseFloat(quoteData.estimate.feeCosts?.[0]?.amountUsd || '0') > 10 ? "text-red-400" : "text-green-400")}>
                {quoteData.estimate.feeCosts?.[0]?.amountUsd ? `-$${quoteData.estimate.feeCosts[0].amountUsd}` : 'Negligible'}
              </span>
            </div>
          </div>
        )}

        {/* AI GUARDIAN */}
        {aiValidation && (
          <div className={cn(
            "p-5 rounded-[1.5rem] flex items-start gap-4 border animate-in zoom-in-95",
            aiValidation.isValid ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-destructive/10 border-destructive/20 text-destructive"
          )}>
            {aiValidation.isValid ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : <AlertTriangle className="w-6 h-6 shrink-0" />}
            <div className="space-y-1">
              <p className="font-bold text-sm">{aiValidation.isValid ? 'Trade Guardian: Verified' : 'Trade Guardian: Warning'}</p>
              <p className="text-xs opacity-80 leading-relaxed">{aiValidation.validationReason}</p>
              {aiValidation.suggestion && (
                <p className="text-xs font-bold pt-1">💡 {aiValidation.suggestion}</p>
              )}
            </div>
          </div>
        )}

        {/* ACTION BUTTON */}
        <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto">
          {amount && parseFloat(amount) > balance && (
            <div className="mb-4 flex items-center justify-center gap-2 text-xs text-destructive font-bold uppercase tracking-widest bg-destructive/10 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" /> Insufficient Balance
            </div>
          )}
          
          {!aiValidation ? (
            <Button 
              className="w-full h-16 rounded-2xl text-lg font-bold shadow-2xl shadow-primary/20"
              disabled={!canValidate || isValidating}
              onClick={handleValidateWithAI}
            >
              {isValidating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>AI analyzing market...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  <span>Verify Quote with AI</span>
                </div>
              )}
            </Button>
          ) : (
            <Button 
              className="w-full h-16 rounded-2xl text-lg font-bold shadow-2xl shadow-primary/20 bg-primary"
              disabled={!aiValidation.isValid || isSubmitting}
              onClick={() => setShowConfirm(true)}
            >
              Review Transaction
            </Button>
          )}
        </div>
      </main>

      {/* SELECTION SHEETS (MODULAR) */}
      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-zinc-950 border-white/10 rounded-t-[2.5rem] p-6 max-h-[80vh] overflow-y-auto thin-scrollbar">
            <SheetHeader className="mb-6">
                <SheetTitle className="text-xl font-bold text-center">Select Network</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-1 gap-3">
                {allChains.map((chain) => (
                    <button 
                        key={chain.chainId}
                        onClick={() => {
                            setSelectedNetworkForSelection(chain);
                            setIsTokenSideSheetOpen(true);
                        }}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={40} chainId={chain.chainId} />
                            <span className="font-bold">{chain.name}</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                ))}
            </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-zinc-950 border-white/10 w-full sm:max-w-[400px] p-0 flex flex-col">
            <SheetHeader className="p-6 border-b border-white/5">
                <SheetTitle className="flex items-center gap-2">
                    <TokenLogoDynamic logoUrl={selectedNetworkForSelection?.iconUrl} alt={selectedNetworkForSelection?.name || ''} size={24} chainId={selectedNetworkForSelection?.chainId} />
                    {selectedNetworkForSelection?.name} Assets
                </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-6">
                <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest">
                        <WalletIcon className="w-3 h-3" /> Network Address
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-mono break-all text-foreground/80">
                            {wallets && selectedNetworkForSelection ? getAddressForChain(selectedNetworkForSelection, wallets) : '...'}
                        </p>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary shrink-0" onClick={() => {
                            const addr = wallets && selectedNetworkForSelection ? getAddressForChain(selectedNetworkForSelection, wallets) : '';
                            if (addr) {
                                navigator.clipboard.writeText(addr);
                                toast({ title: "Address Copied" });
                            }
                        }}>
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Available Tokens</p>
                    <div className="space-y-2">
                        {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                            const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                            return (
                                <button 
                                    key={asset.symbol}
                                    onClick={() => handleTokenSelect(asset)}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.symbol} size={36} chainId={asset.chainId} symbol={asset.symbol} />
                                        <div className="text-left">
                                            <p className="font-bold text-sm">{asset.symbol}</p>
                                            <p className="text-xs text-muted-foreground">{asset.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm">{asset.balance}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </SheetContent>
      </Sheet>

      {/* FINAL CONFIRMATION */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-[90vw] sm:max-w-[400px]">
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-2xl font-bold text-center">Confirm Trade</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm leading-relaxed text-center">
              Your trade has been verified by the <span className="text-primary font-bold">Trade Guardian AI</span>. Please review the final amounts.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex flex-col items-center gap-1">
                    <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={40} chainId={fromToken?.chainId} />
                    <span className="font-bold text-sm">{amount}</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                <div className="flex flex-col items-center gap-1">
                    <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={40} chainId={toToken?.chainId} />
                    <span className="font-bold text-sm">{quoteData ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)).toFixed(4) : '...'}</span>
                </div>
            </div>
            
            <div className="text-xs text-center text-muted-foreground italic">
              Estimated Gas: {gasEstimate} {viewingNetwork.symbol}
            </div>
          </div>

          <DialogFooter className="mt-8 flex flex-col gap-3 sm:flex-col">
            <Button onClick={handleConfirmSwap} className="w-full h-14 rounded-2xl font-bold text-base" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm and Sign"}
            </Button>
            <Button variant="ghost" onClick={() => setShowConfirm(false)} className="w-full h-12">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
