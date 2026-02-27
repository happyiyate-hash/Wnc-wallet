
'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Loader2, 
  ChevronDown,
  ShieldCheck,
  Plane,
  Fuel,
  Timer,
  Zap,
  ArrowRightLeft,
  Settings2
} from 'lucide-react';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import GlobalTokenSelector from '@/components/shared/global-token-selector';
import type { AssetRow } from '@/lib/types';

function SwapClient() {
  const { viewingNetwork, balances, prices, wallets, infuraApiKey, allAssets, allChainsMap } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');

  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isCrossChain = fromToken && toToken && fromToken.chainId !== toToken.chainId;

  useEffect(() => {
    if (!fromToken && allAssets.length > 0) {
      const fromSymbol = searchParams.get('symbol') || searchParams.get('fromSymbol');
      const chainIdParam = parseInt(searchParams.get('chainId') || '');
      const targetChainId = !isNaN(chainIdParam) ? chainIdParam : viewingNetwork.chainId;
      const found = allAssets.find(a => a.symbol === fromSymbol && a.chainId === targetChainId) || allAssets[0];
      if (found) setFromToken({ ...found });
    }
    if (!toToken && allAssets.length > 0 && fromToken) {
      const found = allAssets.find(a => a.symbol !== fromToken?.symbol) || allAssets[allAssets.length - 1];
      if (found) setToToken({ ...found });
    }
  }, [allAssets, searchParams, fromToken, viewingNetwork.chainId]);

  useEffect(() => {
    const fetchUnifiedQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey) {
        setQuoteData(null);
        return;
      }

      setIsQuoteLoading(true);
      setFetchError(null);

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
        setQuoteData(data);
      } catch (e: any) {
        // Fallback estimate
        const fromPrice = prices[(fromToken.priceId || fromToken.address)?.toLowerCase()]?.price || 0;
        const toPrice = prices[(toToken.priceId || toToken.address)?.toLowerCase()]?.price || 0;
        if (fromPrice && toPrice) {
            const rawOut = (parseFloat(debouncedAmount) * fromPrice) / toPrice;
            setQuoteData({ isFallback: true, estimate: { toAmount: ethers.parseUnits((rawOut * 0.97).toFixed(6), toToken.decimals || 18).toString() } });
        } else {
            setFetchError("No route found");
        }
      } finally {
        setIsQuoteLoading(false);
      }
    };

    fetchUnifiedQuote();
  }, [debouncedAmount, fromToken, toToken, wallets, infuraApiKey, allChainsMap, prices]);

  const handleOpenSelector = (type: 'from' | 'to') => {
    setSelectionType(type);
    setIsSelectorOpen(true);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setQuoteData(null);
  };

  const estimatedReceivedAmount = quoteData?.estimate?.toAmount 
    ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, toToken?.decimals || 18)) 
    : 0;

  const fromChainColor = fromToken ? (allChainsMap[fromToken.chainId]?.themeColor || '#818cf8') : '#818cf8';
  const toChainColor = toToken ? (allChainsMap[toToken.chainId]?.themeColor || '#818cf8') : '#818cf8';

  return (
    <div className="flex flex-col min-h-full bg-[#050505] text-foreground relative">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex flex-col items-center text-center">
            <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none">{isCrossChain ? 'Bridge' : 'Swap'}</h1>
            <div className="flex items-center gap-1.5 mt-1.5"><ShieldCheck className="w-2.5 h-2.5 text-primary" /><span className="text-[8px] text-primary font-black uppercase tracking-tighter">Institutional Route</span></div>
        </div>
        <Button variant="ghost" size="icon"><Settings2 className="w-5 h-5 text-muted-foreground" /></Button>
      </header>

      <main className="flex-1 w-full space-y-1 pb-40 pt-6 px-4">
        <section style={{ backgroundColor: `${fromChainColor}15`, borderColor: `${fromChainColor}30` }} className="w-full border p-4 rounded-[2rem] space-y-2">
          <div className="flex items-center justify-between">
            <button onClick={() => handleOpenSelector('from')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-2 py-1 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={20} chainId={fromToken?.chainId} symbol={fromToken?.symbol} />
                <span className="font-black text-[10px] text-white uppercase">{fromToken?.symbol}</span>
                <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
            <div className="text-right"><span className="text-[7px] font-black text-muted-foreground uppercase opacity-40">From {allChainsMap[fromToken?.chainId || 1]?.name}</span></div>
          </div>
          <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-[2.2rem] font-black bg-transparent border-none p-0 h-auto focus-visible:ring-0 placeholder:text-zinc-800 tracking-tighter" />
        </section>

        <div className="relative h-6 flex items-center justify-center z-10"><div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-primary shadow-2xl"><ArrowRightLeft className="w-4 h-4" /></div></div>

        <section style={{ backgroundColor: `${toChainColor}15`, borderColor: `${toChainColor}30` }} className="w-full border p-4 rounded-[2rem] space-y-2">
          <div className="flex items-center justify-between">
            <button onClick={() => handleOpenSelector('to')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-2 py-1 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={20} chainId={toToken?.chainId} symbol={toToken?.symbol} />
                <span className="font-black text-[10px] text-white uppercase">{toToken?.symbol}</span>
                <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
            <div className="text-right"><span className="text-[7px] font-black text-muted-foreground uppercase opacity-40">To {allChainsMap[toToken?.chainId || 1]?.name}</span></div>
          </div>
          <div className="text-[2.2rem] font-black tracking-tighter">
            {isQuoteLoading ? <Skeleton className="h-10 w-24 bg-white/5 rounded-lg" /> : estimatedReceivedAmount.toFixed(6)}
          </div>
        </section>
      </main>

      <GlobalTokenSelector 
        isOpen={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        onSelect={handleTokenSelect}
        title="Network Selector"
      />

      <div className="fixed bottom-8 left-0 right-0 px-6 z-40">
          <Button className="w-full h-16 rounded-full font-black text-lg shadow-2xl border-b-4 border-primary/50" disabled={!amount || isQuoteLoading}>{isQuoteLoading ? 'Searching...' : 'Swap'}</Button>
      </div>
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SwapClient />
    </Suspense>
  );
}
