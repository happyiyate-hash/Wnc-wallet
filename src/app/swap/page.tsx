'use client';

import { useState, useMemo } from 'react';
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
  GitBranch,
  ChevronRight,
  Wallet as WalletIcon,
  Copy
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function SwapPage() {
  const { allChains, viewingNetwork, balances, wallets } = useWallet();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  // Swap State
  const [fromToken, setFromToken] = useState(getInitialAssets(viewingNetwork.chainId)[0] || null);
  const [toToken, setToToken] = useState(getInitialAssets(viewingNetwork.chainId)[1] || null);
  const [amount, setAmount] = useState('');
  
  // Selection Sheets State
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  // Workflow States
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock Market Data
  const gasFeeUsd = 2.45;
  const slippage = 0.5;
  const priceImpact = -0.08;

  const balance = parseFloat(fromToken?.balance || '0');
  const canValidate = parseFloat(amount) > 0 && parseFloat(amount) <= balance && fromToken && toToken;

  const handleFlip = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setValidationResult(null);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') {
        setFromToken(token);
    } else {
        setToToken(token);
    }
    setValidationResult(null);
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
  };

  const handleValidateSwap = async () => {
    if (!canValidate) return;
    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await currencyConversionWithLLMValidation({
        fromCurrency: fromToken.symbol,
        toCurrency: toToken.symbol,
        amount: parseFloat(amount),
      });
      setValidationResult(result);
    } catch (e) {
      toast({ title: "Validation Error", description: "AI could not verify this rate.", variant: "destructive" });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmSwap = async () => {
    if (!user || !validationResult?.isValid) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('transactions').insert({
          user_id: user.id, type: 'swap', amount: parseFloat(amount), status: 'pending', timestamp: new Date().toISOString()
      });
      if (error) throw error;
      
      toast({ title: "Swap Initiated", description: `Swapping ${amount} ${fromToken.symbol} for ${toToken.symbol}...` });
      await new Promise(r => setTimeout(r, 2000));
      toast({ title: "Swap Confirmed" });
      router.push('/');
    } catch (e) {
      toast({ title: "Swap Failed", description: "Could not broadcast transaction.", variant: "destructive" });
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
        <h1 className="text-lg font-bold">Swap</h1>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Info className="w-5 h-5 text-muted-foreground" />
        </Button>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4 overflow-y-auto thin-scrollbar pb-32">
        {/* FROM PANEL */}
        <div className="p-6 rounded-[2rem] bg-secondary/30 border border-white/5 space-y-4 relative overflow-hidden group">
          <div className="flex justify-between items-center relative z-10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">You Pay</span>
            <span className="text-[10px] text-muted-foreground font-mono">Balance: {fromToken?.balance}</span>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <Input 
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setValidationResult(null);
              }}
              className="text-4xl font-bold bg-transparent border-none p-0 focus-visible:ring-0 h-auto"
            />
            <Button 
                variant="outline" 
                className="rounded-2xl gap-2 h-12 px-4 bg-white/5 border-white/10 hover:bg-white/10 shrink-0"
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

        {/* FLIP BUTTON */}
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
        <div className="p-6 rounded-[2rem] bg-secondary/30 border border-white/5 space-y-4 relative overflow-hidden">
          <div className="flex justify-between items-center relative z-10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">You Receive (Est.)</span>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="flex-1 text-4xl font-bold truncate">
              {validationResult?.convertedAmount ? validationResult.convertedAmount.toFixed(6) : '0.00'}
            </div>
            <Button 
                variant="outline" 
                className="rounded-2xl gap-2 h-12 px-4 bg-white/5 border-white/10 hover:bg-white/10 shrink-0"
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

        {/* MARKET STATS */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center space-y-1">
             <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                <Fuel className="w-3 h-3" /> Gas
             </div>
             <p className="text-xs font-bold">${gasFeeUsd}</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center space-y-1">
             <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Slippage</div>
             <p className="text-xs font-bold">{slippage}%</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center space-y-1">
             <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Impact</div>
             <p className={cn("text-xs font-bold", priceImpact < -1 ? "text-red-400" : "text-green-400")}>{priceImpact}%</p>
          </div>
        </div>

        {/* AI VALIDATION ALERT */}
        {validationResult && (
          <div className={cn(
            "p-4 rounded-2xl flex items-start gap-3 border animate-in fade-in slide-in-from-top-2",
            validationResult.isValid ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-destructive/10 border-destructive/20 text-destructive"
          )}>
            {validationResult.isValid ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <div className="text-sm">
              <p className="font-bold">{validationResult.isValid ? 'Rate Validated' : 'Suspicious Rate Detected'}</p>
              <p className="opacity-80 text-xs leading-relaxed">
                {validationResult.isValid ? 'AI confirms this conversion rate is plausible.' : validationResult.validationReason}
              </p>
            </div>
          </div>
        )}

        {/* CTA BUTTON - MOVED TO BOTTOM */}
        <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto">
          {!validationResult ? (
            <Button 
              className="w-full h-16 rounded-2xl text-lg font-bold shadow-2xl shadow-primary/20"
              disabled={!canValidate || isValidating}
              onClick={handleValidateSwap}
            >
              {isValidating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying with AI...</span>
                </div>
              ) : "Verify Rate with AI"}
            </Button>
          ) : (
            <Button 
              className="w-full h-16 rounded-2xl text-lg font-bold shadow-2xl shadow-primary/20 bg-primary"
              disabled={!validationResult.isValid || isSubmitting}
              onClick={() => setShowConfirm(true)}
            >
              Review & Swap
            </Button>
          )}
        </div>
      </main>

      {/* SELECTION FLOW */}
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
                {/* ADDRESS HEADER */}
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

      {/* CONFIRMATION DIALOG */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-[90vw] sm:max-w-[400px]">
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-2xl font-bold text-center">Confirm Swap</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm leading-relaxed text-center">
              Please review your transaction details. Once confirmed, this swap will be broadcasted to the <span className="text-primary font-bold">{viewingNetwork.name}</span> network.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                    <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={32} chainId={fromToken?.chainId} />
                    <span className="font-bold">{amount} {fromToken?.symbol}</span>
                </div>
                <Zap className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center gap-3 text-right">
                    <span className="font-bold">{validationResult?.convertedAmount?.toFixed(4)} {toToken?.symbol}</span>
                    <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={32} chainId={toToken?.chainId} />
                </div>
            </div>
          </div>

          <DialogFooter className="mt-8 flex flex-col gap-3 sm:flex-col">
            <Button onClick={handleConfirmSwap} className="w-full h-14 rounded-2xl font-bold text-base" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Swap"}
            </Button>
            <Button variant="ghost" onClick={() => setShowConfirm(false)} className="w-full h-12">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
