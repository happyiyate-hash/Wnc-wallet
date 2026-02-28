
'use client';

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
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
  Settings2,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  Info
} from 'lucide-react';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import GlobalTokenSelector from '@/components/shared/global-token-selector';
import type { AssetRow } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

interface SwapQuote {
  id: string;
  provider: string;
  logo: string | null;
  receiveAmount: number;
  fee: number;
  eta: string;
  isBest?: boolean;
}

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
  const [quotes, setQuotes] = useState<SwapQuote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ANIMATION & LONG PRESS STATE
  const [rotation, setRotation] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

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
    const fetchQuotes = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0) {
        setQuotes([]);
        return;
      }

      setIsQuoteLoading(true);
      setFetchError(null);
      setQuotes([]); // Reset for new stream

      try {
        // SIMULATING LIVE PROVIDER STREAM
        // In production, this calls multiple quote APIs or a single aggregator like Li.Fi
        const basePrice = prices[(fromToken.priceId || fromToken.address)?.toLowerCase()]?.price || 1;
        const targetPrice = prices[(toToken.priceId || toToken.address)?.toLowerCase()]?.price || 1;
        const rawOutput = (parseFloat(debouncedAmount) * basePrice) / targetPrice;

        const providers = [
          { name: '1inch', id: '1inch', fee: 0.25, slip: 0.998 },
          { name: 'Uniswap', id: 'uni', fee: 0.35, slip: 0.995 },
          { name: 'Paraswap', id: 'para', fee: 0.20, slip: 0.999 },
          { name: '0x', id: '0x', fee: 0.30, slip: 0.997 },
        ];

        const streamedQuotes: SwapQuote[] = [];
        
        for (const p of providers) {
          // Add random latency to simulate live feel
          await new Promise(r => setTimeout(resolve => r(resolve), Math.random() * 800 + 400));
          
          const quote: SwapQuote = {
            id: p.id,
            provider: p.name,
            logo: null,
            receiveAmount: rawOutput * p.slip,
            fee: p.fee,
            eta: '~15s'
          };
          
          streamedQuotes.push(quote);
          // Sort as they come in: (Amount - Fee) descending
          const sorted = [...streamedQuotes].sort((a, b) => (b.receiveAmount - b.fee) - (a.receiveAmount - a.fee));
          
          // Mark best
          const best = sorted[0];
          const finalBatch = sorted.map(q => ({ ...q, isBest: q.id === best.id }));
          
          setQuotes(finalBatch);
          if (!selectedQuoteId || streamedQuotes.length === 1) {
            setSelectedQuoteId(best.id);
          }
        }
      } catch (e: any) {
        setFetchError("Market data unavailable");
      } finally {
        setIsQuoteLoading(false);
      }
    };

    fetchQuotes();
  }, [debouncedAmount, fromToken, toToken, prices]);

  const selectedQuote = useMemo(() => quotes.find(q => q.id === selectedQuoteId), [quotes, selectedQuoteId]);

  const handleOpenSelector = (type: 'from' | 'to') => {
    setSelectionType(type);
    setIsSelectorOpen(true);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setQuotes([]);
  };

  const handleSwapTokens = () => {
    if (!fromToken || !toToken) return;
    const tempFrom = { ...fromToken };
    const tempTo = { ...toToken };
    setFromToken(tempTo);
    setToToken(tempFrom);
    setQuotes([]);
  };

  const startVoltageHold = () => {
    isLongPressRef.current = false;
    setIsHolding(true);
    holdTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
    }, 400);
  };

  const endVoltageHold = () => {
    setIsHolding(false);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (!isLongPressRef.current) {
      setRotation(prev => prev + 360);
      handleSwapTokens();
    }
  };

  const fromChainColor = fromToken ? (allChainsMap[fromToken.chainId]?.themeColor || '#818cf8') : '#818cf8';
  const toChainColor = toToken ? (allChainsMap[toToken.chainId]?.themeColor || '#818cf8') : '#818cf8';

  return (
    <div className="flex flex-col min-h-full bg-[#050505] text-foreground relative overflow-hidden">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex flex-col items-center text-center">
            <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none">{isCrossChain ? 'Bridge' : 'Swap'}</h1>
            <div className="flex items-center gap-1.5 mt-1.5"><ShieldCheck className="w-2.5 h-2.5 text-primary" /><span className="text-[8px] text-primary font-black uppercase tracking-tighter">Institutional Route</span></div>
        </div>
        <Button variant="ghost" size="icon"><Settings2 className="w-5 h-5 text-muted-foreground" /></Button>
      </header>

      {/* FLOATING QUOTE COMPARISON CARD */}
      <AnimatePresence>
        {amount && (parseFloat(amount) > 0) && (
          <motion.div 
            initial={{ y: -200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -200, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 150 }}
            className="fixed top-20 left-4 right-4 z-[40] max-w-lg mx-auto"
          >
            <div className="bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-5 shadow-2xl overflow-hidden relative group">
              {/* Dynamic Gradient Border Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-purple-500/20 opacity-50 pointer-events-none" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isQuoteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <TrendingUp className="w-3.5 h-3.5 text-primary" />}
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                      {isQuoteLoading ? 'Analyzing Liquidity Nodes...' : 'Optimal Routes Found'}
                    </h3>
                  </div>
                  {selectedQuote?.isBest && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Best Rate Applied</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 max-h-[180px] overflow-y-auto thin-scrollbar pr-1">
                  {quotes.length === 0 && isQuoteLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map(i => (
                        <div key={i} className="h-14 bg-white/5 rounded-2xl animate-pulse flex items-center px-4 gap-3">
                          <Skeleton className="w-8 h-8 rounded-full bg-white/5" />
                          <div className="space-y-1.5 flex-1">
                            <Skeleton className="h-2 w-24 bg-white/5" />
                            <Skeleton className="h-2 w-16 bg-white/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    quotes.map((quote, idx) => (
                      <motion.button
                        key={quote.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => setSelectedQuoteId(quote.id)}
                        className={cn(
                          "w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.98] relative group/row",
                          selectedQuoteId === quote.id 
                            ? "bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(139,92,246,0.1)]" 
                            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] opacity-60 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center font-black text-[10px] text-white">
                            {quote.provider[0]}
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-white flex items-center gap-1.5">
                              {quote.provider}
                              {quote.isBest && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
                            </p>
                            <div className="flex items-center gap-2 text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">
                              <span className="flex items-center gap-1"><Fuel className="w-2 h-2" /> ${quote.fee.toFixed(2)}</span>
                              <span className="flex items-center gap-1"><Timer className="w-2 h-2" /> {quote.eta}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-white tabular-nums">
                            {quote.receiveAmount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </p>
                          <p className="text-[8px] font-bold text-muted-foreground uppercase">{toToken?.symbol}</p>
                        </div>
                        {selectedQuoteId === quote.id && (
                          <div className="absolute inset-0 border border-primary/20 rounded-2xl animate-pulse pointer-events-none" />
                        )}
                      </motion.button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full space-y-1 pb-40 pt-6 px-4 relative z-10">
        {/* FROM NODE */}
        <section style={{ backgroundColor: `${fromChainColor}15`, borderColor: `${fromChainColor}30` }} className="w-full border p-5 rounded-[2.5rem] space-y-2 shadow-2xl">
          <div className="flex items-center justify-between">
            <button onClick={() => handleOpenSelector('from')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-1.5 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={22} chainId={fromToken?.chainId} symbol={fromToken?.symbol} />
                <span className="font-black text-[11px] text-white uppercase tracking-tighter">{fromToken?.symbol}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            <div className="text-right"><span className="text-[8px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">FROM {allChainsMap[fromToken?.chainId || 1]?.name}</span></div>
          </div>
          <Input 
            type="number" 
            placeholder="0.00" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            className="text-[2.8rem] font-black bg-transparent border-none p-0 h-auto focus-visible:ring-0 placeholder:text-zinc-800 tracking-tighter text-white" 
          />
        </section>

        {/* VOLTAGE DIVIDER */}
        <div className="relative h-8 flex items-center justify-center z-20">
          <motion.div 
            animate={{ 
              rotate: isHolding ? [rotation, rotation + 360] : rotation 
            }}
            transition={{ 
              rotate: { 
                duration: isHolding ? 0.3 : 0.6, 
                repeat: isHolding ? Infinity : 0, 
                ease: "linear" 
              } 
            }}
            onPointerDown={startVoltageHold}
            onPointerUp={endVoltageHold}
            onPointerLeave={() => { setIsHolding(false); if (holdTimerRef.current) clearTimeout(holdTimerRef.current); }}
            className="w-14 h-14 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-primary shadow-2xl shadow-primary/20 cursor-pointer active:scale-90 transition-transform relative"
          >
            <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
            <Zap className="w-6 h-6 fill-current relative z-10" />
          </motion.div>
        </div>

        {/* TO NODE */}
        <section style={{ backgroundColor: `${toChainColor}15`, borderColor: `${toChainColor}30` }} className="w-full border p-5 rounded-[2.5rem] space-y-2 shadow-2xl">
          <div className="flex items-center justify-between">
            <button onClick={() => handleOpenSelector('to')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-1.5 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={22} chainId={toToken?.chainId} symbol={toToken?.symbol} />
                <span className="font-black text-[11px] text-white uppercase tracking-tighter">{toToken?.symbol}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            <div className="text-right"><span className="text-[8px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">TO {allChainsMap[toToken?.chainId || 1]?.name}</span></div>
          </div>
          <div className="text-[2.8rem] font-black tracking-tighter text-white flex items-center h-[1.5em] transition-all">
            {isQuoteLoading && !selectedQuote ? (
              <div className="flex gap-1">
                {[1, 2, 3].map(i => <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} className="w-3 h-3 rounded-full bg-primary/20" />)}
              </div>
            ) : (
              <motion.span 
                key={selectedQuoteId}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="tabular-nums"
              >
                {selectedQuote ? selectedQuote.receiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '0.00'}
              </motion.span>
            )}
          </div>
        </section>

        {selectedQuote && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-4 flex items-center justify-center gap-4"
          >
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground tracking-widest">
              <span className="text-white/40">Provider:</span>
              <span className="text-primary">{selectedQuote.provider}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-white/10" />
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground tracking-widest">
              <span className="text-white/40">Slippage:</span>
              <span className="text-primary">0.5%</span>
            </div>
          </motion.div>
        )}
      </main>

      <GlobalTokenSelector 
        isOpen={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        onSelect={handleTokenSelect}
        title="Network Selector"
      />

      <div className="fixed bottom-8 left-0 right-0 px-6 z-40">
          <Button 
            className="w-full h-16 rounded-full font-black text-lg shadow-2xl border-b-4 border-primary/50 transition-all active:scale-[0.98] shadow-primary/20" 
            disabled={!amount || isQuoteLoading}
          >
            {isQuoteLoading && !selectedQuote ? 'Discovering Best Route...' : 'Execute Institutional Swap'}
          </Button>
      </div>
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-[#050505]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SwapClient />
    </Suspense>
  );
}
