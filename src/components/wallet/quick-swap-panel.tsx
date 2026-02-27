
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
  ChevronDown
} from 'lucide-react';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import type { AssetRow } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import GlobalTokenSelector from '../shared/global-token-selector';

interface QuickSwapPanelProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function QuickSwapPanel({ isOpen, onOpenChange }: QuickSwapPanelProps) {
  const { allAssets, wallets, infuraApiKey, allChainsMap, prices } = useWallet();
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');

  useEffect(() => {
    if (isOpen && allAssets.length >= 2 && !fromToken) {
        setFromToken(allAssets[0]);
        setToToken(allAssets.find(a => a.symbol !== allAssets[0].symbol) || allAssets[1]);
    }
  }, [isOpen, allAssets, fromToken]);

  useEffect(() => {
    const fetchQuickQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey) {
        setQuote(null);
        return;
      }
      setIsQuoteLoading(true);
      try {
        const sourceChainConfig = allChainsMap[fromToken.chainId];
        const sourceWallets = wallets?.filter(w => w.type === (sourceChainConfig.type || 'evm')) || [];
        const userAddr = sourceWallets[0]?.address || '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
        const params = new URLSearchParams({
          fromChain: fromToken.chainId.toString(),
          toChain: toToken.chainId.toString(),
          fromToken: fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address,
          toToken: toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address,
          fromAmount: ethers.parseUnits(debouncedAmount, fromToken.decimals || 18).toString(),
          fromAddress: userAddr,
          slippage: '0.005'
        });
        const res = await fetch(`/api/bridge/quote?${params.toString()}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setQuote(data);
      } catch (e) {
        const fromPrice = prices[(fromToken.priceId || fromToken.address)?.toLowerCase()]?.price || 0;
        const toPrice = prices[(toToken.priceId || toToken.address)?.toLowerCase()]?.price || 0;
        if (fromPrice && toPrice) {
            const rawOut = (parseFloat(debouncedAmount) * fromPrice) / toPrice;
            setQuote({ isFallback: true, estimate: { toAmount: ethers.parseUnits((rawOut * 0.97).toFixed(6), toToken.decimals || 18).toString() } });
        }
      } finally {
        setIsQuoteLoading(false);
      }
    };
    fetchQuickQuote();
  }, [debouncedAmount, fromToken, toToken, wallets, infuraApiKey, allChainsMap, prices]);

  const handleOpenSelector = (type: 'from' | 'to') => {
    setSelectionType(type);
    setIsSelectorOpen(true);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setQuote(null);
  };

  const estimatedReceived = quote?.estimate?.toAmount 
    ? ethers.formatUnits(quote.estimate.toAmount, toToken?.decimals || 18) 
    : null;

  const fromChainColor = fromToken ? (allChainsMap[fromToken.chainId]?.themeColor || '#818cf8') : '#818cf8';

  return (
    <>
        <div className={cn("fixed top-3 left-2 right-2 z-[100] transition-all duration-500 ease-in-out pointer-events-none", isOpen ? "translate-y-0 opacity-100" : "-translate-y-[150%] opacity-0")}>
            <div style={{ boxShadow: `0 8px 40px -10px ${fromChainColor}60`, borderColor: `${fromChainColor}40`, backgroundColor: '#050505' }} className="border rounded-[2rem] p-3.5 max-w-lg mx-auto pointer-events-auto shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2 bg-primary/10 px-3 py-0.5 rounded-full border border-primary/20"><Zap className="w-2.5 h-2.5 text-primary fill-primary" /><span className="text-[7px] font-black uppercase tracking-[0.15em] text-primary">INSTITUTIONAL SYNC</span></div>
                    <button onClick={() => onOpenChange(false)} className="p-1 rounded-full hover:bg-white/10 transition-colors"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
                <div className="flex items-center gap-1.5 mb-3">
                    <div className="flex-1 flex items-center bg-white/[0.03] border border-white/5 rounded-xl h-10 px-3 gap-2">
                        <button onClick={() => handleOpenSelector('from')} className="shrink-0 active:scale-90 transition-all">
                            <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={22} chainId={fromToken?.chainId} symbol={fromToken?.symbol} />
                        </button>
                        <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent border-none text-xs font-black p-0 h-auto focus-visible:ring-0 text-white placeholder:text-zinc-800" />
                    </div>
                    <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center"><Plane className="w-3 h-3 text-primary" /></div>
                    <div className="flex-1 flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl h-10 px-3 gap-2 overflow-hidden">
                        {isQuoteLoading && !quote ? <Skeleton className="h-3 w-16 bg-white/10 rounded" /> : <span className="text-xs font-black tracking-tight tabular-nums truncate">{estimatedReceived ? parseFloat(estimatedReceived).toFixed(4) : '0.0000'}</span>}
                        <button onClick={() => handleOpenSelector('to')} className="shrink-0 active:scale-90 transition-all">
                            <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={22} chainId={toToken?.chainId} symbol={toToken?.symbol} />
                        </button>
                    </div>
                </div>
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3 text-[8px] font-black uppercase text-muted-foreground/50">
                        <div className="flex items-center gap-1"><Timer className="w-2.5 h-2.5 text-primary" /><span>~15s</span></div>
                        <div className="flex items-center gap-1"><Fuel className="w-2.5 h-2.5 text-primary" /><span>LOW GAS</span></div>
                    </div>
                    <Button size="sm" className="h-7 px-4 rounded-xl font-black text-[8px] uppercase tracking-widest bg-primary hover:bg-primary/90" disabled={!amount || isQuoteLoading}>EXECUTE</Button>
                </div>
            </div>
        </div>
        <GlobalTokenSelector 
            isOpen={isSelectorOpen}
            onOpenChange={setIsSelectorOpen}
            onSelect={handleTokenSelect}
            title="Switch Network"
        />
    </>
  );
}
