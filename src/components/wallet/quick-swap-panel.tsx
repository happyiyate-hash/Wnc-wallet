
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from '@/contexts/wallet-provider';
import { Plane, Timer, Fuel, ChevronDown, Loader2 } from 'lucide-react';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import type { AssetRow } from '@/lib/types';

interface QuickSwapPanelProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function QuickSwapPanel({ isOpen, onOpenChange }: QuickSwapPanelProps) {
  const { allAssets, viewingNetwork, wallets, infuraApiKey } = useWallet();
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 500);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);

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

  const estimatedReceived = quote ? ethers.formatUnits(quote.estimate.toAmount, 18) : '0';

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="top" 
        className="bg-black/90 backdrop-blur-2xl border-b border-white/5 p-0 rounded-b-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-6 pt-10 space-y-8 max-w-lg mx-auto">
            {/* Header / Assets Row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <TokenLogoDynamic 
                        logoUrl={fromToken?.iconUrl} 
                        alt={fromToken?.symbol || ''} 
                        size={40} 
                        chainId={fromToken?.chainId}
                        name={fromToken?.name}
                        symbol={fromToken?.symbol}
                    />
                    <div className="text-left">
                        <p className="text-xs font-black uppercase tracking-widest text-white">{fromToken?.name || fromToken?.symbol}</p>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center px-4 relative">
                    <div className="absolute inset-x-0 h-px border-t border-dashed border-white/10" />
                    <Plane className="w-5 h-5 text-primary relative z-10" />
                </div>

                <div className="flex items-center gap-3 text-right">
                    <div className="text-right">
                        <p className="text-xs font-black uppercase tracking-widest text-white">{toToken?.name || toToken?.symbol}</p>
                    </div>
                    <TokenLogoDynamic 
                        logoUrl={toToken?.iconUrl} 
                        alt={toToken?.symbol || ''} 
                        size={40} 
                        chainId={toToken?.chainId}
                        name={toToken?.name}
                        symbol={toToken?.symbol}
                    />
                </div>
            </div>

            {/* Amounts Row */}
            <div className="flex items-baseline justify-between gap-4">
                <Input 
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent border-none text-4xl font-black p-0 h-auto focus-visible:ring-0 tracking-tighter text-white placeholder:text-zinc-800"
                />
                <div className="text-4xl font-black text-white/40 tracking-tighter transition-all">
                    {isQuoteLoading ? <Loader2 className="w-8 h-8 animate-spin inline-block" /> : parseFloat(estimatedReceived).toFixed(6)}
                </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Meta Stats Row */}
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <span className="text-white/20">EST</span>
                        <span className="text-primary">RELAYDEPOSITORY</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary/80">
                        <TokenLogoDynamic size={12} logoUrl={fromToken?.iconUrl} chainId={fromToken?.chainId} alt="asset" />
                        <span>{Math.ceil((quote?.estimate?.executionDuration || 300) / 60)}s</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] mb-0.5 opacity-40">FFEE</span>
                        <span className="text-white">0%</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] mb-0.5 opacity-40">SLIPPAGE</span>
                        <span className="text-white">0.5%</span>
                    </div>
                </div>
            </div>

            <Button 
                className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
                disabled={!amount || isQuoteLoading}
            >
                {isQuoteLoading ? "Fetching Quote..." : "Quick Execute"}
            </Button>
        </div>
        
        {/* Grabber */}
        <div className="pb-4 pt-2">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
