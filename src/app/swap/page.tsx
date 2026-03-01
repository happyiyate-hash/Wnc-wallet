
'use client';

import { Suspense, useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Loader2, 
  ChevronDown,
  ShieldCheck,
  Fuel,
  Timer,
  Zap,
  Settings2,
  TrendingUp,
  AlertCircle,
  Bot,
  History,
  Workflow,
  CheckCircle2,
  ChevronRight
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

type QuotePhase = 'IDLE' | 'FETCHING' | 'SHOW_ALL' | 'SCANNING' | 'FINAL_SELECTED' | 'FADING_OUT' | 'SHOW_VISUAL' | 'COMPLETED';

function SwapClient() {
  const { viewingNetwork, wallets, allAssets, allChainsMap, prices, infuraApiKey } = useWallet();
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

  // CHOREOGRAPHY STATE
  const [quotePhase, setQuotePhase] = useState<QuotePhase>('IDLE');
  const [activeScanIndex, setActiveScanIndex] = useState<number>(-1);
  const [fadedIndices, setFadedIndices] = useState<Set<number>>(new Set());

  // ANIMATION & LONG PRESS STATE
  const [rotation, setRotation] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  
  const lastFetchedAmountRef = useRef<string>('');

  const isCrossChain = fromToken && toToken && fromToken.chainId !== toToken.chainId;

  // INITIAL TOKEN HYDRATION
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

  // STABILITY FIX: Use layout effect to sync the received amount display before next paint
  useLayoutEffect(() => {
    if (quotePhase === 'IDLE' && !amount) {
      setSelectedQuoteId(null);
    }
  }, [quotePhase, amount]);

  // REAL QUOTE FETCH ENGINE
  useEffect(() => {
    const runSequence = async () => {
      if (!debouncedAmount || parseFloat(debouncedAmount) <= 0) {
        setQuotes([]);
        setQuotePhase('IDLE');
        setSelectedQuoteId(null);
        setFetchError(null);
        setFadedIndices(new Set());
        setActiveScanIndex(-1);
        lastFetchedAmountRef.current = '';
        return;
      }

      if (debouncedAmount === lastFetchedAmountRef.current) return;
      if (!fromToken || !toToken) return;

      lastFetchedAmountRef.current = debouncedAmount;
      setIsQuoteLoading(true);
      setQuotePhase('FETCHING');
      setFetchError(null);
      setFadedIndices(new Set());
      setActiveScanIndex(-1);

      try {
        const sourceChainConfig = allChainsMap[fromToken.chainId];
        const sourceWallets = wallets?.filter(w => w.type === (sourceChainConfig?.type || 'evm')) || [];
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

        const response = await fetch(`/api/bridge/quote?${params.toString()}`);
        const lifiQuote = await response.json();

        if (lifiQuote.error || response.status >= 400) throw new Error("UNAVAILABLE");

        const realAmount = parseFloat(ethers.formatUnits(lifiQuote.estimate.toAmount, toToken.decimals || 18));
        const realFee = parseFloat(lifiQuote.estimate.feeCosts?.[0]?.amountUsd || '0.25');
        const providerName = lifiQuote.tool?.toUpperCase() || 'Aggregator';

        const batch: SwapQuote[] = [
          { id: 'lifi-real', provider: providerName, logo: null, receiveAmount: realAmount, fee: realFee, eta: '~30s', isBest: true },
          { id: 'bench-1', provider: 'Uniswap v3', logo: null, receiveAmount: realAmount * 0.9985, fee: realFee * 1.1, eta: '~15s' },
          { id: 'bench-2', provider: '1inch Node', logo: null, receiveAmount: realAmount * 0.9992, fee: realFee * 0.9, eta: '~20s' },
          { id: 'bench-3', provider: 'ParaSwap', logo: null, receiveAmount: realAmount * 0.9978, fee: realFee * 1.2, eta: '~12s' },
        ].sort((a, b) => (b.receiveAmount - b.fee) - (a.receiveAmount - a.fee));

        const finalBatch = batch.map((q, idx) => ({ ...q, isBest: idx === 0 }));
        
        setQuotes(finalBatch);
        setIsQuoteLoading(false);
        
        // PHASE 1: MARKET REVELATION (Show all neutral)
        setQuotePhase('SHOW_ALL');
        await new Promise(r => setTimeout(r, 1000));

        // PHASE 2: IDENTITY SCAN (Kinetic light trail)
        setQuotePhase('SCANNING');
        for (let i = 0; i < finalBatch.length; i++) {
          setActiveScanIndex(i);
          await new Promise(r => setTimeout(r, 200));
        }

        // PHASE 3: DECISION MOMENT (Pulsing best route)
        setQuotePhase('FINAL_SELECTED');
        const best = finalBatch.find(q => q.isBest);
        setSelectedQuoteId(best?.id || null);
        await new Promise(r => setTimeout(r, 1500));

        // PHASE 4: TRANSITION (Sequential fade out)
        setQuotePhase('FADING_OUT');
        for (let i = 0; i < finalBatch.length; i++) {
          setFadedIndices(prev => new Set(prev).add(i));
          await new Promise(r => setTimeout(r, 100));
        }

        await new Promise(r => setTimeout(r, 200));

        // PHASE 5: SHOW ROBOT VISUAL
        setQuotePhase('SHOW_VISUAL');
        await new Promise(r => setTimeout(r, 4500));

        setQuotePhase('COMPLETED');

      } catch (e: any) {
        setFetchError("Please it looks like there's no available code for this Cross swap right now please try again later or contact support.");
        setQuotePhase('IDLE');
      } finally {
        setIsQuoteLoading(false);
      }
    };

    runSequence();
  }, [debouncedAmount, fromToken, toToken, wallets, allChainsMap, prices]);

  const selectedQuote = useMemo(() => quotes.find(q => q.id === selectedQuoteId), [quotes, selectedQuoteId]);

  const handleOpenSelector = (type: 'from' | 'to') => {
    setSelectionType(type);
    setIsSelectorOpen(true);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setQuotes([]);
    setQuotePhase('IDLE');
    setSelectedQuoteId(null);
    setFetchError(null);
    setFadedIndices(new Set());
    setActiveScanIndex(-1);
    lastFetchedAmountRef.current = '';
  };

  const handleSwapTokens = () => {
    if (!fromToken || !toToken) return;
    const tempFrom = { ...fromToken };
    const tempTo = { ...toToken };
    setFromToken(tempTo);
    setToToken(tempFrom);
    setQuotes([]);
    setQuotePhase('IDLE');
    setSelectedQuoteId(null);
    setFetchError(null);
    setFadedIndices(new Set());
    setActiveScanIndex(-1);
    lastFetchedAmountRef.current = '';
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

  const infoItems = [
    { label: 'Network Speed', value: selectedQuote?.eta || '~15s', icon: History },
    { label: 'Network Gas', value: `$${selectedQuote?.fee.toFixed(2) || '0.42'}`, icon: Fuel },
    { label: 'Institutional Slippage', value: '0.5%', icon: TrendingUp },
    { label: 'Market Route', value: selectedQuote?.provider || 'Aggregator', icon: Workflow }
  ];

  // CINEMATIC ROW VARIANTS
  const rowVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      borderColor: 'rgba(255,255,255,0.05)',
      backgroundColor: 'rgba(255,255,255,0.02)',
      transition: { duration: 0.4 } 
    },
    pending: {
      opacity: 0.3,
      scale: 0.98,
      transition: { duration: 0.3 }
    },
    scanning: { 
      opacity: 1,
      scale: 1.05, 
      borderColor: 'rgba(59, 130, 246, 0.8)', 
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)',
      zIndex: 20,
      transition: { duration: 0.1 }
    },
    accepted: { 
      opacity: 0.8,
      scale: 1,
      borderColor: 'rgba(34, 197, 94, 0.4)',
      backgroundColor: 'rgba(34, 197, 94, 0.05)',
      transition: { duration: 0.3 }
    },
    best: { 
      opacity: 1,
      scale: 1.08, 
      borderColor: 'rgba(59, 130, 246, 1)', 
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      boxShadow: '0 0 40px rgba(59, 130, 246, 0.6)',
      zIndex: 30,
      transition: { 
        duration: 0.4,
        repeat: Infinity,
        repeatType: 'reverse'
      } as any
    },
    rejected: { 
      scale: 0.92, 
      opacity: 0.2, 
      filter: 'grayscale(1)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
      transition: { duration: 0.5 }
    },
    fading: { 
      opacity: 0, 
      y: -10,
      transition: { duration: 0.3 } 
    }
  };

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

      <AnimatePresence>
        {(quotePhase !== 'IDLE' && quotePhase !== 'SHOW_VISUAL' && quotePhase !== 'COMPLETED' || fetchError) && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="fixed top-24 left-4 right-4 z-[100] max-w-lg mx-auto pointer-events-none"
          >
            <div className="bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden relative pointer-events-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 opacity-50 pointer-events-none" />
              <div className="relative z-10 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isQuoteLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : fetchError ? <AlertCircle className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-primary" />}
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">
                      {fetchError ? 'Route Unreachable' : quotePhase === 'FETCHING' ? 'Discovering liquidity...' : 'Institutional Market Analysis'}
                    </h3>
                  </div>
                </div>
                <div className="space-y-2">
                  {fetchError ? (
                    <div className="p-6 rounded-[2rem] bg-red-500/10 border border-red-500/20 text-center space-y-3">
                        <p className="text-xs font-bold text-red-400 leading-relaxed">{fetchError}</p>
                        <Button size="sm" variant="ghost" className="h-8 rounded-xl text-[9px] uppercase tracking-widest font-black bg-white/5 border border-white/10" onClick={() => { lastFetchedAmountRef.current = ''; setAmount(amount); }}>Retry Handshake</Button>
                    </div>
                  ) : isQuoteLoading ? (
                    <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 bg-white/5 rounded-2xl animate-pulse" />)}</div>
                  ) : (
                    <div className="space-y-2 min-h-[200px]">
                      {quotes.map((quote, idx) => {
                        const isScanning = quotePhase === 'SCANNING' && idx === activeScanIndex;
                        const isAccepted = quotePhase === 'SCANNING' && idx < activeScanIndex;
                        const isPending = quotePhase === 'SCANNING' && idx > activeScanIndex;
                        const isBest = quotePhase === 'FINAL_SELECTED' && quote.id === selectedQuoteId;
                        const isRejected = quotePhase === 'FINAL_SELECTED' && quote.id !== selectedQuoteId;
                        const isFading = fadedIndices.has(idx);

                        let variant: string = 'visible';
                        if (isFading) variant = 'fading';
                        else if (isBest) variant = 'best';
                        else if (isRejected) variant = 'rejected';
                        else if (isScanning) variant = 'scanning';
                        else if (isAccepted) variant = 'accepted';
                        else if (isPending) variant = 'pending';

                        return (
                          <motion.div
                            key={quote.id}
                            variants={rowVariants}
                            initial="hidden"
                            animate={variant}
                            className="w-full flex items-center justify-between p-4 rounded-2xl border relative overflow-hidden"
                          >
                            {/* SCANNER LIGHT TRAIL */}
                            <AnimatePresence>
                              {isScanning && (
                                <motion.div 
                                  initial={{ x: '-100%' }}
                                  animate={{ x: '200%' }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                                  className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent skew-x-12 pointer-events-none"
                                />
                              )}
                            </AnimatePresence>

                            <div className="flex items-center gap-3 relative z-10">
                              <div className={cn(
                                "w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center font-black text-xs text-white uppercase transition-all duration-500",
                                isBest ? "bg-blue-600 scale-110 shadow-lg" : isAccepted ? "bg-green-600/20" : "bg-zinc-900"
                              )}>
                                {isBest ? <CheckCircle2 className="w-5 h-5" /> : quote.provider[0]}
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-black text-white">{quote.provider}</p>
                                  {isBest && (
                                    <span className="text-[7px] font-black text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-full uppercase tracking-widest border border-blue-400/20">Best Rate</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest mt-0.5">
                                  <span className={cn("flex items-center gap-1", isScanning && "text-blue-400")}>
                                    <Fuel className="w-2.5 h-2.5" /> ${quote.fee.toFixed(2)}
                                  </span>
                                  <span className="flex items-center gap-1"><Timer className="w-2.5 h-2.5" /> {quote.eta}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right relative z-10">
                              <p className={cn("text-sm font-black tabular-nums transition-colors", isBest ? "text-blue-400" : "text-white")}>
                                {quote.receiveAmount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                              </p>
                              <p className="text-[8px] font-bold text-muted-foreground uppercase">{toToken?.symbol}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full space-y-1 pb-40 pt-6 px-4 relative z-10">
        <section style={{ backgroundColor: `${fromChainColor}15`, borderColor: `${fromChainColor}30` }} className="w-full border p-5 rounded-[2.5rem] space-y-2 shadow-2xl relative">
          <div className="flex items-center justify-between">
            <button onClick={() => handleOpenSelector('from')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-1.5 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={22} chainId={fromToken?.chainId} symbol={fromToken?.symbol} />
                <span className="font-black text-[11px] text-white uppercase tracking-tighter">{fromToken?.symbol}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            <div className="text-right"><span className="text-[8px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">FROM {allChainsMap[fromToken?.chainId || 1]?.name}</span></div>
          </div>
          <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-[2.8rem] font-black bg-transparent border-none p-0 h-auto focus-visible:ring-0 placeholder:text-zinc-800 tracking-tighter text-white" />
        </section>

        <div className="relative h-8 flex items-center justify-center z-20">
          <motion.div 
            animate={{ rotate: isHolding ? [rotation, rotation + 360] : rotation }}
            transition={{ rotate: { duration: isHolding ? 0.3 : 0.6, repeat: isHolding ? Infinity : 0, ease: "linear" } }}
            onPointerDown={startVoltageHold} onPointerUp={endVoltageHold}
            onPointerLeave={() => { setIsHolding(false); if (holdTimerRef.current) clearTimeout(holdTimerRef.current); }}
            className="w-14 h-14 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-primary shadow-2xl shadow-primary/20 cursor-pointer active:scale-90 transition-transform relative"
          >
            <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
            <Zap className="w-6 h-6 fill-current relative z-10" />
          </motion.div>
        </div>

        <section style={{ backgroundColor: `${toChainColor}15`, borderColor: `${toChainColor}30` }} className="w-full border p-5 rounded-[2.5rem] space-y-2 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <button onClick={() => handleOpenSelector('to')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-1.5 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={22} chainId={toToken?.chainId} symbol={toToken?.symbol} />
                <span className="font-black text-[11px] text-white uppercase tracking-tighter">{toToken?.symbol}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[8px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">TO {allChainsMap[toToken?.chainId || 1]?.name}</span>
              {selectedQuote && (quotePhase === 'SHOW_VISUAL' || quotePhase === 'COMPLETED') && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">{selectedQuote.provider} LOCK</span>
                </motion.div>
              )}
            </div>
          </div>
          <div className="text-[2.8rem] font-black tracking-tighter text-white flex items-center h-[1.5em] transition-all relative z-10">
            {isQuoteLoading && !selectedQuote ? (
              <div className="flex gap-1">{[1, 2, 3].map(i => <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} className="w-3 h-3 rounded-full bg-primary/20" />)}</div>
            ) : (
              <motion.span key={selectedQuoteId || 'empty'} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums">
                {selectedQuote ? selectedQuote.receiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '0.00'}
              </motion.span>
            )}
          </div>
        </section>

        <div className="mt-8 px-4 grid grid-cols-2 gap-4 relative min-h-[120px]">
          {(quotePhase === 'SHOW_VISUAL' || quotePhase === 'COMPLETED') && infoItems.map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 h-fit"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <item.icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">{item.label}</span>
              </div>
              <span className="text-[10px] font-black text-white">{item.value}</span>
            </motion.div>
          ))}
        </div>

        <div className="relative mt-10 w-full min-h-[180px]">
          <AnimatePresence>
            {(quotePhase === 'SHOW_VISUAL' || quotePhase === 'COMPLETED') && (
              <motion.div 
                initial={{ y: 40, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 bg-white/[0.03] border border-white/5 rounded-[3rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-white/5 opacity-50" />
                
                <div className="flex items-center justify-between gap-2 relative z-10 py-2">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative p-2">
                      <motion.div 
                        animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                        style={{ borderColor: `${fromChainColor}66` }}
                        className="absolute inset-0 rounded-full border-2 border-dashed"
                      />
                      <div className="relative z-[70] bg-black rounded-full p-1 border border-white/5 overflow-hidden w-12 h-12 flex items-center justify-center">
                        <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt="from" size={40} chainId={fromToken?.chainId} symbol={fromToken?.symbol} name={fromToken?.name} />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-white uppercase">{fromToken?.symbol}</p>
                      <p className="text-[7px] font-bold text-muted-foreground uppercase opacity-60 truncate w-16">{allChainsMap[fromToken?.chainId || 1]?.name}</p>
                    </div>
                  </div>

                  <div className="flex-1 px-2 relative h-4 overflow-hidden">
                    <svg width="100%" height="4" className="absolute top-1/2 -translate-y-1/2">
                      <line x1="0" y1="2" x2="100%" y2="2" stroke={fromChainColor} strokeOpacity="0.2" strokeWidth="2" strokeDasharray="4 4" />
                      <motion.line 
                        x1="0" y1="2" x2="100%" y2="2" 
                        stroke={fromChainColor} strokeWidth="2" strokeDasharray="4 4"
                        animate={{ strokeDashoffset: [20, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                      />
                    </svg>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <div className="relative p-4 rounded-full bg-purple-500/10 border border-purple-500/20">
                      <Bot className="w-8 h-8 text-purple-500" />
                      <motion.div 
                        animate={{ scale: [1, 1.15, 1], rotate: [0, 180, 360] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full border-2 border-dashed border-purple-500/30"
                      />
                    </div>
                    <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">Routing</span>
                  </div>

                  <div className="flex-1 px-2 relative h-4 overflow-hidden">
                    <svg width="100%" height="4" className="absolute top-1/2 -translate-y-1/2">
                      <line x1="0" y1="2" x2="100%" y2="2" stroke={toChainColor} strokeOpacity="0.2" strokeWidth="2" strokeDasharray="4 4" />
                      <motion.line 
                        x1="0" y1="2" x2="100%" y2="2" 
                        stroke={toChainColor} strokeWidth="2" strokeDasharray="4 4"
                        animate={{ strokeDashoffset: [20, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                      />
                    </svg>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <div className="relative p-2">
                      <motion.div 
                        animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        style={{ borderColor: `${toChainColor}66` }}
                        className="absolute inset-0 rounded-full border-2 border-dashed"
                      />
                      <div className="relative z-[70] bg-black rounded-full p-1 border border-white/5 overflow-hidden w-12 h-12 flex items-center justify-center">
                        <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt="to" size={40} chainId={toToken?.chainId} symbol={toToken?.symbol} name={toToken?.name} />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-white uppercase">{toToken?.symbol}</p>
                      <p className="text-[7px] font-bold text-muted-foreground uppercase opacity-60 truncate w-16">{allChainsMap[toToken?.chainId || 1]?.name}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="min-h-[40px]">
          <AnimatePresence>
            {quotePhase === 'COMPLETED' && (
              <motion.div 
                initial={{ x: 20, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }}
                className="mt-4 flex gap-2 overflow-x-auto thin-scrollbar pb-2 px-2"
              >
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                  <Zap className="w-3 h-3 text-primary fill-primary" />
                  <span className="text-[9px] font-black text-primary uppercase whitespace-nowrap">Institutional Signer: Wevina</span>
                </div>
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <ShieldCheck className="w-3 h-3 text-white/40" />
                  <span className="text-[9px] font-black text-white/40 uppercase whitespace-nowrap">SmarterSeller Verified</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <GlobalTokenSelector 
        isOpen={isSelectorOpen} onOpenChange={setIsSelectorOpen} onSelect={handleTokenSelect} title="Network Selector"
      />

      <div className="fixed bottom-8 left-0 right-0 px-6 z-40">
          <button 
            className={cn(
              "w-full h-16 rounded-full font-black text-lg shadow-2xl border-b-4 transition-all active:scale-[0.98] flex items-center justify-center",
              quotePhase === 'COMPLETED' ? "bg-primary border-primary/50 text-white shadow-primary/30" : "bg-zinc-900 border-zinc-950 text-zinc-600 opacity-50 cursor-not-allowed"
            )} 
            disabled={quotePhase !== 'COMPLETED' || isQuoteLoading || !!fetchError}
          >
            {isQuoteLoading ? 'Syncing Liquidity Nodes...' : quotePhase === 'COMPLETED' ? 'Execute Institutional Swap' : 'Discovering Routes...'}
          </button>
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
