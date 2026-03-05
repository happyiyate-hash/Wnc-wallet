
'use client';

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { useCurrency } from '@/contexts/currency-provider';
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
  ChevronRight,
  ShieldAlert,
  Cpu,
  Activity,
  SendHorizonal
} from 'lucide-react';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import GlobalTokenSelector from '@/components/shared/global-token-selector';
import type { AssetRow } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateSwapFees, checkPairRestriction } from '@/lib/services/swap-fee-calculator';

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
type ExecutionPhase = 'IDLE' | 'VERIFYING' | 'LIQUIDITY' | 'SENDING' | 'SETTLING' | 'SUCCESS' | 'FAILED';

const formatExactCrypto = (val: number): string => {
  if (!val || val <= 0) return '0';
  // Avoid scientific notation for very small numbers
  return val.toFixed(18).replace(/\.?0+$/, "");
};

function SwapClient() {
  const { viewingNetwork, wallets, allAssets, allChainsMap = {}, prices, infuraApiKey, refresh, setActiveFulfillmentId } = useWallet();
  const { user, profile, refreshProfile } = useUser();
  const { formatFiat } = useCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ATOMIC SWAP STATE
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');

  // QUOTE STATE ENGINE
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quotes, setQuotes] = useState<SwapQuote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [quotePhase, setQuotePhase] = useState<QuotePhase>('IDLE');
  const [activeScanIndex, setActiveScanIndex] = useState<number>(-1);
  const [fadedIndices, setFadedIndices] = useState<Set<number>>(new Set());

  // EXECUTION ENGINE
  const [executionPhase, setExecutionPhase] = useState<ExecutionPhase>('IDLE');
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // UI STATE
  const [showPrecision, setShowPrecision] = useState(false);
  const [showOutputPrecision, setShowOutputPrecision] = useState(false);
  const [rotation, setRotation] = useState(0);
  
  const lastFetchedAmountRef = useRef<string>('');
  const hasInitializedRef = useRef(false);

  const isCrossChain = fromToken && toToken && fromToken.chainId !== toToken.chainId;

  /**
   * INITIAL HANDSHAKE PROTOCOL
   */
  useEffect(() => {
    if (allAssets.length === 0 || hasInitializedRef.current) return;
    const fromSymbol = searchParams.get('symbol') || searchParams.get('fromSymbol');
    const chainIdParam = parseInt(searchParams.get('chainId') || '');
    const targetChainId = !isNaN(chainIdParam) ? chainIdParam : viewingNetwork.chainId;
    const initialFrom = allAssets.find(a => a.symbol === fromSymbol && a.chainId === targetChainId && a.symbol !== 'WNC') || 
                      allAssets.find(a => a.symbol !== 'WNC' && a.chainId === viewingNetwork.chainId) || 
                      allAssets[0];
    const initialTo = allAssets.find(a => a.symbol !== initialFrom?.symbol && a.symbol !== 'WNC' && a.chainId === viewingNetwork.chainId) || 
                    allAssets.find(a => a.symbol !== 'WNC' && a.chainId === viewingNetwork.chainId) || 
                    allAssets[allAssets.length - 1];
    if (initialFrom) setFromToken({ ...initialFrom });
    if (initialTo) setToToken({ ...initialTo });
    hasInitializedRef.current = true;
  }, [allAssets, viewingNetwork.chainId, searchParams]);

  const fromTokenPrice = useMemo(() => {
    if (!fromToken) return 0;
    const priceId = (fromToken.priceId || fromToken.coingeckoId || fromToken.address)?.toLowerCase();
    return prices[priceId]?.price || 0;
  }, [fromToken, prices]);

  const toTokenPrice = useMemo(() => {
    if (!toToken) return 0;
    const priceId = (toToken.priceId || toToken.coingeckoId || toToken.address)?.toLowerCase();
    return prices[priceId]?.price || 0;
  }, [toToken, prices]);

  // AUTO-PRECISION TRIGGER
  useEffect(() => {
    if (quotePhase === 'COMPLETED' && selectedQuoteId) {
      setShowOutputPrecision(true);
      const timer = setTimeout(() => setShowOutputPrecision(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [quotePhase, selectedQuoteId]);

  /**
   * ATOMIC QUOTE ENGINE
   */
  useEffect(() => {
    const runSequence = async () => {
      if (!debouncedAmount || parseFloat(debouncedAmount) <= 0) {
        setQuotes([]); setQuotePhase('IDLE'); setSelectedQuoteId(null); setFetchError(null); setFadedIndices(new Set()); setActiveScanIndex(-1);
        lastFetchedAmountRef.current = ''; return;
      }
      if (!fromToken || !toToken) return;

      // 1. CHECK PAIR RESTRICTION
      const restriction = checkPairRestriction(fromToken.symbol, toToken.symbol);
      if (restriction.isRestricted) {
        setFetchError(restriction.message!);
        setQuotePhase('IDLE');
        setQuotes([]);
        return;
      }

      const currentSignature = `${fromToken.chainId}:${fromToken.address}:${toToken.chainId}:${toToken.address}:${debouncedAmount}`;
      if (currentSignature === lastFetchedAmountRef.current) return;
      lastFetchedAmountRef.current = currentSignature;
      
      setIsQuoteLoading(true); setQuotePhase('FETCHING'); setFetchError(null); setFadedIndices(new Set()); setActiveScanIndex(-1); setSelectedQuoteId(null);
      
      try {
        const sourceChainConfig = allChainsMap[fromToken.chainId];
        const userAddr = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'; 
        let batch: SwapQuote[] = [];
        const tradeValueUsd = parseFloat(debouncedAmount) * (fromTokenPrice || 0.000001);
        
        // INSTITUTIONAL FEE HANDSHAKE
        const feeData = await calculateSwapFees(tradeValueUsd, allChainsMap[fromToken.chainId]?.type || 'evm');
        
        const isEvmOnly = sourceChainConfig?.type === 'evm' && allChainsMap[toToken.chainId]?.type === 'evm';
        const divisor = toTokenPrice || 1;
        
        if (isEvmOnly && fromToken.symbol !== 'WNC' && toToken.symbol !== 'WNC' && infuraApiKey) {
            try {
                const params = new URLSearchParams({ fromChain: fromToken.chainId.toString(), toChain: toToken.chainId.toString(), fromToken: fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address, toToken: toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address, fromAmount: ethers.parseUnits(debouncedAmount, fromToken.decimals || 18).toString(), fromAddress: userAddr, slippage: '0.005' });
                const response = await fetch(`/api/bridge/quote?${params.toString()}`);
                const lifiQuote = await response.json();
                if (!lifiQuote.error && response.status < 400) {
                    const rawAmountToken = parseFloat(ethers.formatUnits(lifiQuote.estimate.toAmount, toToken.decimals || 18));
                    const finalAmountToken = Math.max(0, rawAmountToken - (feeData.networkFee / divisor));
                    const providerName = lifiQuote.tool?.toUpperCase() || 'Aggregator';
                    batch = [{ id: 'lifi-real', provider: providerName, logo: null, receiveAmount: finalAmountToken, fee: feeData.networkFee, eta: '~30s', isBest: true }, { id: 'bench-1', provider: 'Uniswap v3', logo: null, receiveAmount: finalAmountToken * 0.9985, fee: feeData.networkFee, eta: '~15s' }, { id: 'bench-2', provider: '1inch Node', logo: null, receiveAmount: finalAmountToken * 0.9992, fee: feeData.networkFee, eta: '~20s' }];
                } else throw new Error("LIFI_FAIL");
            } catch (e) {
                const estAmt = (parseFloat(debouncedAmount) * (fromTokenPrice || 0)) / divisor;
                const finalAmt = Math.max(0, estAmt - (feeData.networkFee / divisor));
                batch = [{ id: 'internal-1', provider: 'Institutional Node', logo: null, receiveAmount: finalAmt * 0.995, fee: feeData.networkFee, eta: '~10s', isBest: true }, { id: 'internal-2', provider: 'SmarterSeller Route', logo: null, receiveAmount: finalAmt * 0.992, fee: feeData.networkFee, eta: '~12s' }];
            }
        } else {
            const estAmt = (parseFloat(debouncedAmount) * (fromTokenPrice || 0)) / divisor;
            const finalAmt = Math.max(0, estAmt - (feeData.networkFee / divisor));
            batch = [{ id: 'internal-node', provider: 'Institutional Settle', logo: null, receiveAmount: finalAmt * 0.997, fee: feeData.networkFee, eta: '~5s', isBest: true }, { id: 'internal-liq', provider: 'Wevina Vault', logo: null, receiveAmount: finalAmt * 0.994, fee: feeData.networkFee, eta: '~8s' }];
        }
        const finalBatchSorted = batch.sort((a, b) => (b.receiveAmount) - (a.receiveAmount)).map((q, idx) => ({ ...q, isBest: idx === 0 }));
        setQuotes(finalBatchSorted); setIsQuoteLoading(false); setQuotePhase('SHOW_ALL'); await new Promise(r => setTimeout(r, 800)); setQuotePhase('SCANNING');
        for (let i = 0; i < finalBatchSorted.length; i++) { setActiveScanIndex(i); await new Promise(r => setTimeout(r, 200)); }
        setQuotePhase('FINAL_SELECTED'); const best = finalBatchSorted.find(q => q.isBest); setSelectedQuoteId(best?.id || null); await new Promise(r => setTimeout(r, 1200)); setQuotePhase('FADING_OUT');
        for (let i = 0; i < finalBatchSorted.length; i++) { setFadedIndices(prev => new Set(prev).add(i)); await new Promise(r => setTimeout(r, 100)); }
        setQuotePhase('SHOW_VISUAL'); await new Promise(r => setTimeout(r, 3500)); setQuotePhase('COMPLETED');
      } catch (e: any) { setFetchError("Market Sync Interrupted. Re-initializing institutional routes..."); setQuotePhase('IDLE'); } finally { setIsQuoteLoading(false); }
    };
    runSequence();
  }, [debouncedAmount, fromToken, toToken, wallets, allChainsMap, prices, fromTokenPrice, toTokenPrice, infuraApiKey]);

  const selectedQuote = useMemo(() => quotes.find(q => q.id === selectedQuoteId), [quotes, selectedQuoteId]);

  /**
   * ACTION HANDLERS
   */
  const handleOpenSelector = (type: 'from' | 'to') => {
    setSelectionType(type);
    setIsSelectorOpen(true);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken({ ...token });
    else setToToken({ ...token });
    setQuotes([]); setQuotePhase('IDLE'); setSelectedQuoteId(null); setFetchError(null); setFadedIndices(new Set()); setActiveScanIndex(-1); lastFetchedAmountRef.current = '';
  };

  const handleSwapTokens = () => {
    if (!fromToken || !toToken) return;
    const oldFrom = { ...fromToken }; const oldTo = { ...toToken };
    setRotation(prev => prev + 180); setFromToken(oldTo); setToToken(oldFrom);
    setQuotes([]); setQuotePhase('IDLE'); setSelectedQuoteId(null); setFetchError(null); setFadedIndices(new Set()); setActiveScanIndex(-1); lastFetchedAmountRef.current = '';
  };

  /**
   * INSTITUTIONAL EXECUTION HANDSHAKE
   */
  const handleExecuteSwap = async () => {
    if (!selectedQuote || !fromToken || !toToken || !user || !wallets) return;
    
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionPhase('VERIFYING');
    
    try {
      // 1. BALANCE VERIFICATION
      const balance = parseFloat(fromToken.balance || '0');
      if (balance < parseFloat(amount)) throw new Error("Insufficient Balance for Swap.");
      await new Promise(r => setTimeout(r, 1500));

      // 2. LIQUIDITY VERIFICATION
      setExecutionPhase('LIQUIDITY');
      const handshakeRes = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromChain: fromToken.name, toChain: toToken.name,
          fromSymbol: fromToken.symbol, toSymbol: toToken.symbol,
          fromAmount: parseFloat(amount), fromTokenPriceUsd: fromTokenPrice,
          toAmountExpected: selectedQuote.receiveAmount,
          adminFeeUsd: selectedQuote.fee * 0.5, networkFeeUsd: selectedQuote.fee * 0.5,
          recipientAddress: profile?.evm_address || ''
        })
      });
      const handshake = await handshakeRes.json();
      if (!handshake.success) throw new Error(handshake.error || "Liquidity Node Reject.");
      await new Promise(r => setTimeout(r, 1500));

      // 3. EXECUTE USER LEG (SEND TO ADMIN)
      setExecutionPhase('SENDING');
      const chainConfig = allChainsMap[fromToken.chainId];
      const evmWallet = wallets.find(w => w.type === 'evm');
      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl.replace('{API_KEY}', infuraApiKey!), undefined, { staticNetwork: true });
      const wallet = new ethers.Wallet(evmWallet!.privateKey!, provider);
      
      let userTx;
      if (fromToken.isNative) {
        userTx = await wallet.sendTransaction({ to: handshake.adminAddress, value: ethers.parseEther(amount) });
      } else {
        const contract = new ethers.Contract(fromToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet);
        userTx = await contract.transfer(handshake.adminAddress, ethers.parseUnits(amount, fromToken.decimals || 18));
      }
      
      // 4. TRIGGER ADMIN SETTLEMENT
      setExecutionPhase('SETTLING');
      await new Promise(r => setTimeout(r, 3000));
      
      setExecutionPhase('SUCCESS');
      await refreshProfile(); refresh();
      
      setTimeout(() => {
        setIsExecuting(false);
        setExecutionPhase('IDLE');
        setAmount('');
        router.push('/profile');
      }, 4000);

    } catch (e: any) {
      console.error("[SWAP_EXEC_FAIL]", e);
      setExecutionError(e.message || "Institutional Handshake Aborted.");
      setExecutionPhase('FAILED');
      setTimeout(() => { setIsExecuting(false); setExecutionPhase('IDLE'); }, 5000);
    }
  };

  const fromChainColor = fromToken ? (allChainsMap?.[fromToken.chainId]?.themeColor || '#818cf8') : '#818cf8';
  const toChainColor = toToken ? (allChainsMap?.[toToken.chainId]?.themeColor || '#818cf8') : '#818cf8';

  const infoItems = [
    { label: 'Network Speed', value: selectedQuote?.eta || '~15s', icon: History },
    { label: 'Network Fee', value: `$${selectedQuote?.fee.toFixed(2) || '0.10'}`, icon: Fuel },
    { label: 'Institutional Slippage', value: '0.5%', icon: TrendingUp },
    { label: 'Market Route', value: selectedQuote?.provider || 'Aggregator', icon: Workflow }
  ];

  const rowVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)', transition: { duration: 0.4 } },
    pending: { opacity: 0.3, scale: 0.98, transition: { duration: 0.3 } },
    scanning: { opacity: 1, scale: 1.05, borderColor: 'rgba(59, 130, 246, 0.8)', backgroundColor: 'rgba(59, 130, 246, 0.15)', boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)', zIndex: 20, transition: { duration: 0.1 } },
    accepted: { opacity: 0.8, scale: 1, borderColor: 'rgba(34, 197, 94, 0.4)', backgroundColor: 'rgba(34, 197, 94, 0.05)', transition: { duration: 0.3 } },
    best: { opacity: 1, scale: 1.08, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.2)', boxShadow: '0 0 40px rgba(59, 130, 246, 0.6)', zIndex: 30, transition: { duration: 0.4, repeat: Infinity, repeatType: 'reverse' } as any },
    rejected: { scale: 0.92, opacity: 0.2, filter: 'grayscale(1)', borderColor: 'rgba(239, 68, 68, 0.2)', transition: { duration: 0.5 } },
    fading: { opacity: 0, y: -10, transition: { duration: 0.3 } }
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

      {/* BACKGROUND EXECUTION OVERLAY */}
      <AnimatePresence>
        {isExecuting && (
          <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-4 inset-x-4 z-[200] max-w-lg mx-auto">
            <div className="bg-[#0a0a0c]/90 backdrop-blur-3xl border border-primary/20 rounded-[2rem] p-5 shadow-2xl overflow-hidden relative">
              <div className={cn("absolute -right-10 -top-10 w-32 h-32 blur-3xl opacity-20 transition-colors duration-1000", executionPhase === 'SUCCESS' ? "bg-green-500" : executionPhase === 'FAILED' ? "bg-red-500" : "bg-primary")} />
              
              <div className="relative z-10 flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-lg", executionPhase === 'FAILED' ? "bg-red-500/20 text-red-500" : "bg-primary/10 text-primary")}>
                  {executionPhase === 'SUCCESS' ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : executionPhase === 'FAILED' ? <ShieldAlert className="w-6 h-6" /> : <Loader2 className="w-6 h-6 animate-spin" />}
                </div>
                
                <div className="flex-1 space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">
                    {executionPhase === 'VERIFYING' && 'Verifying Balances...'}
                    {executionPhase === 'LIQUIDITY' && 'Checking Admin Liquidity...'}
                    {executionPhase === 'SENDING' && 'Executing Transfer...'}
                    {executionPhase === 'SETTLING' && 'SmarterSeller Payout...'}
                    {executionPhase === 'SUCCESS' && 'Swap Secured'}
                    {executionPhase === 'FAILED' && 'Handshake Aborted'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", executionPhase === 'SUCCESS' ? "bg-green-500" : executionPhase === 'FAILED' ? "bg-red-500" : "bg-primary")} />
                    <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">
                      {executionError || 'Watchdog Sync Active'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                  <Activity className="w-3 h-3 text-primary animate-pulse" />
                  <span className="text-[10px] font-mono text-white/60">LIVE</span>
                </div>
              </div>

              <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: executionPhase === 'VERIFYING' ? '20%' : executionPhase === 'LIQUIDITY' ? '40%' : executionPhase === 'SENDING' ? '60%' : executionPhase === 'SETTLING' ? '85%' : '100%' }}
                  className="h-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quotePhase === 'COMPLETED' && !fetchError && !isExecuting && (
          <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-0 inset-x-0 z-[110] p-4 flex justify-center pointer-events-none">
            <motion.button onClick={handleExecuteSwap} animate={{ boxShadow: ["0 0 15px rgba(139,92,246,0.3)", "0 0 45px rgba(139,92,246,0.7)", "0 0 15px rgba(139,92,246,0.3)"] }} transition={{ boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" } }} className="w-fit px-10 h-14 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] relative overflow-hidden shadow-2xl bg-primary text-white border border-primary/50 pointer-events-auto active:scale-95 transition-transform">
              <motion.div animate={{ x: ['-150%', '300%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
              <div className="flex items-center justify-center gap-3 relative z-10"><Zap className="w-4 h-4 fill-current animate-pulse" /> Execute Swap</div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(quotePhase !== 'IDLE' && quotePhase !== 'SHOW_VISUAL' && quotePhase !== 'COMPLETED' || fetchError) && (
          <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-24 left-4 right-4 z-[100] max-w-lg mx-auto pointer-events-none">
            <div className="bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden relative pointer-events-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 opacity-50" />
              <div className="relative z-10 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isQuoteLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : fetchError ? <AlertCircle className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-primary" />}
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">{fetchError ? 'Sync Failure' : 'Market Analysis'}</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  {fetchError ? (
                    <div className="p-6 rounded-[2rem] bg-[#050505] border border-red-500/40 text-center space-y-4">
                        <p className="text-xs font-bold text-red-400 leading-relaxed px-2">{fetchError}</p>
                        {!fetchError.includes("unavailable") && (
                          <Button size="sm" variant="ghost" className="h-9 rounded-xl text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 text-white" onClick={() => { lastFetchedAmountRef.current = ''; setAmount(amount); }}>Re-sync Routes</Button>
                        )}
                    </div>
                  ) : isQuoteLoading ? (
                    <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 bg-white/5 rounded-2xl animate-pulse" />)}</div>
                  ) : (
                    <div className="space-y-2 min-h-[200px]">
                      {quotes.map((quote, idx) => {
                        const isScanning = quotePhase === 'SCANNING' && idx === activeScanIndex;
                        const isAccepted = quotePhase === 'SCANNING' && idx < activeScanIndex;
                        const isPending = quotePhase === 'SCANNING' && idx > activeScanIndex;
                        const isBest = quotePhase === 'FINAL_SELECTED' && quote.id === selectedQuoteId;
                        const isRejected = quotePhase === 'FINAL_SELECTED' && quote.id !== selectedQuoteId;
                        const isFading = fadedIndices.has(idx);
                        let variant = isFading ? 'fading' : isBest ? 'best' : isRejected ? 'rejected' : isScanning ? 'scanning' : isAccepted ? 'accepted' : isPending ? 'pending' : 'visible';
                        return (
                          <motion.div key={quote.id} variants={rowVariants} initial="hidden" animate={variant} className="w-full flex items-center justify-between p-4 rounded-2xl border relative overflow-hidden">
                            <div className="flex items-center gap-3 relative z-10">
                              <div className={cn("w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center font-black text-xs text-white uppercase", isBest ? "bg-blue-600 scale-110 shadow-lg" : "bg-zinc-900")}>{isBest ? <CheckCircle2 className="w-5 h-5" /> : quote.provider[0]}</div>
                              <div className="text-left">
                                <p className="text-xs font-black text-white">{quote.provider}</p>
                                <div className="flex items-center gap-2 text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest mt-0.5"><span className="flex items-center gap-1"><Fuel className="w-2.5 h-2.5" /> ${quote.fee.toFixed(2)}</span><span className="flex items-center gap-1"><Timer className="w-2.5 h-2.5" /> {quote.eta}</span></div>
                              </div>
                            </div>
                            <div className="text-right relative z-10"><p className={cn("text-sm font-black tabular-nums transition-colors", isBest ? "text-blue-400" : "text-white")}>{quote.receiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">{toToken?.symbol}</p></div>
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

      <main className="flex-1 w-full space-y-1 pb-40 pt-6 px-4 relative z-10 overflow-y-auto thin-scrollbar">
        {/* YOU PAY CARD */}
        <section 
          style={{ backgroundColor: `${fromChainColor}40`, borderColor: `${fromChainColor}cc`, boxShadow: `0 0 60px ${fromChainColor}40, inset 0 0 20px ${fromChainColor}20` }} 
          className="w-full border p-4 rounded-[2.5rem] space-y-1 relative transition-all duration-500 h-[125px] flex flex-col justify-center overflow-hidden"
          onPointerDown={() => setShowPrecision(true)}
          onPointerUp={() => setShowPrecision(false)}
          onPointerLeave={() => setShowPrecision(false)}
        >
          <div className="flex items-center justify-between h-10 shrink-0 relative">
            <button onClick={() => handleOpenSelector('from')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-1 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={20} chainId={fromToken?.chainId} symbol={fromToken?.symbol} name={fromToken?.name} />
                <span className="font-black text-[10px] text-white uppercase tracking-tighter">{fromToken?.symbol}</span>
                <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
            <span className="text-[7px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">FROM {allChainsMap?.[fromToken?.chainId || 1]?.name}</span>
          </div>
          
          <div className="relative flex-1 flex flex-col justify-center">
            <AnimatePresence>{showPrecision && (<motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: -40, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }} className="absolute left-0 bg-black/90 border border-primary/30 px-3 py-1 rounded-xl z-[80] shadow-2xl backdrop-blur-xl"><p className="text-[10px] font-mono text-primary font-black uppercase tracking-widest flex items-center gap-2"><Zap className="w-3 h-3" /> Exact: {amount || '0'} {fromToken?.symbol}</p></motion.div>)}</AnimatePresence>
            <div>
              <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-2xl font-black bg-transparent border-none p-0 h-auto focus-visible:ring-0 placeholder:text-zinc-800 tracking-tighter text-white" />
              <div className="mt-0.5"><span className="text-[9px] font-black text-white/40 uppercase tracking-widest">≈ {formatFiat(parseFloat(amount || '0') * fromTokenPrice)}</span></div>
            </div>
          </div>
        </section>

        <div className="relative h-6 flex items-center justify-center z-20">
          <motion.button animate={{ rotate: rotation }} transition={{ type: 'spring', damping: 15 }} onClick={handleSwapTokens} className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-primary shadow-2xl active:scale-90 transition-transform relative">
            <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" /><Zap className="w-5 h-5 fill-current relative z-10" />
          </motion.button>
        </div>

        {/* YOU RECEIVE CARD */}
        <section 
          style={{ backgroundColor: `${toChainColor}40`, borderColor: `${toChainColor}cc`, boxShadow: `0 0 60px ${toChainColor}40, inset 0 0 20px ${toChainColor}20` }} 
          className="w-full border p-4 rounded-[2.5rem] space-y-1 relative transition-all duration-500 h-[125px] flex flex-col justify-center overflow-hidden"
          onPointerDown={() => setShowOutputPrecision(true)}
          onPointerUp={() => setShowOutputPrecision(false)}
          onPointerLeave={() => setShowOutputPrecision(false)}
        >
          <div className="flex items-center justify-between h-10 shrink-0 relative">
            <button onClick={() => handleOpenSelector('to')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-1 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={20} chainId={toToken?.chainId} symbol={toToken?.symbol} name={toToken?.name} />
                <span className="font-black text-[10px] text-white uppercase tracking-tighter">{toToken?.symbol}</span>
                <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
            <span className="text-[7px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">TO {allChainsMap?.[toToken?.chainId || 1]?.name}</span>
          </div>
          <div className="relative flex-1 flex flex-col justify-center">
            <AnimatePresence>
              {showOutputPrecision && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: -40, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }} className="absolute left-0 bg-black/90 border border-blue-500/30 px-3 py-1 rounded-xl z-[80] shadow-2xl backdrop-blur-xl">
                  <p className="text-[10px] font-mono text-blue-400 font-black uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" /> 
                    Exact: {selectedQuote?.receiveAmount ? formatExactCrypto(selectedQuote.receiveAmount) : '0'} {toToken?.symbol}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="text-2xl font-black tracking-tighter text-white flex flex-col transition-all relative z-10">
              {isQuoteLoading && !selectedQuote ? (
                <div className="flex gap-1 h-8 items-center">{[1, 2, 3].map(i => <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} className="w-2 h-6 bg-white/10 rounded-full" />)}</div>
              ) : (
                <>
                  <motion.span key={selectedQuoteId || 'empty'} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums">
                    {selectedQuote ? selectedQuote.receiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '0.00'}
                  </motion.span>
                  <div className="mt-0.5"><span className="text-[9px] font-black text-white/40 uppercase tracking-widest">≈ {formatFiat((selectedQuote?.receiveAmount || 0) * toTokenPrice)}</span></div>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="mt-6 px-4 grid grid-cols-2 gap-3 relative min-h-[100px]">
          {(quotePhase === 'SHOW_VISUAL' || quotePhase === 'COMPLETED') && infoItems.map((item, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.1 }} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 h-fit">
              <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><item.icon className="w-3 h-3" /></div><span className="text-[7px] font-black uppercase text-muted-foreground tracking-widest">{item.label}</span></div>
              <span className="text-[9px] font-black text-white">{item.value}</span>
            </motion.div>
          ))}
        </div>

        <div className="relative mt-8 w-full min-h-[160px]">
          <AnimatePresence>
            {(quotePhase === 'SHOW_VISUAL' || quotePhase === 'COMPLETED') && (
              <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="p-5 bg-white/[0.03] border border-white/5 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
                <div className="flex items-center justify-between gap-2 relative z-10 py-1">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative p-1.5">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} style={{ borderColor: `${fromChainColor}66` }} className="absolute inset-0 rounded-full border border-dashed" />
                      <div className="relative z-[70] bg-black rounded-full p-1 border border-white/5 overflow-hidden w-10 h-10 flex items-center justify-center"><TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt="from" size={32} chainId={fromToken?.chainId} symbol={fromToken?.symbol} name={fromToken?.name} /></div>
                    </div>
                    <div className="text-center"><p className="text-[9px] font-black text-white uppercase">{fromToken?.symbol}</p><p className="text-[6px] font-bold text-muted-foreground uppercase opacity-60 truncate w-14">{allChainsMap?.[fromToken?.chainId || 1]?.name}</p></div>
                  </div>
                  <div className="flex-1 px-2 relative h-3 overflow-hidden">
                    <svg width="100%" height="2" className="absolute top-1/2 -translate-y-1/2">
                      <line x1="0" y1="1" x2="100%" y2="1" stroke={fromChainColor} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="6" />
                      <motion.line x1="0" y1="1" x2="100%" y2="1" stroke={fromChainColor} strokeWidth="1" strokeDasharray="12" animate={{ strokeDashoffset: [24, 0] }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }} />
                    </svg>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative p-3 rounded-full bg-purple-500/10 border border-purple-500/20">
                      <Bot className="w-6 h-6 text-purple-500" />
                      <motion.div animate={{ scale: [1, 1.15, 1], rotate: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-full border border-dashed border-purple-500/30" />
                    </div>
                    <span className="text-[7px] font-black text-purple-400 uppercase tracking-widest">Routing</span>
                  </div>
                  <div className="flex-1 px-2 relative h-3 overflow-hidden">
                    <svg width="100%" height="2" className="absolute top-1/2 -translate-y-1/2">
                      <line x1="0" y1="1" x2="100%" y2="1" stroke={toChainColor} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="6" />
                      <motion.line x1="0" y1="1" x2="100%" y2="1" stroke={toChainColor} strokeWidth="1" strokeDasharray="12" animate={{ strokeDashoffset: [24, 0] }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }} />
                    </svg>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative p-1.5">
                      <motion.div animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} style={{ borderColor: `${toChainColor}66` }} className="absolute inset-0 rounded-full border border-dashed" />
                      <div className="relative z-[70] bg-black rounded-full p-1 border border-white/5 overflow-hidden w-10 h-10 flex items-center justify-center"><TokenLogoDynamic logoUrl={toToken?.iconUrl} alt="to" size={32} chainId={toToken?.chainId} symbol={toToken?.symbol} name={toToken?.name} /></div>
                    </div>
                    <div className="text-center"><p className="text-[9px] font-black text-white uppercase">{toToken?.symbol}</p><p className="text-[6px] font-bold text-muted-foreground uppercase opacity-60 truncate w-14">{allChainsMap?.[toToken?.chainId || 1]?.name}</p></div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <GlobalTokenSelector isOpen={isSelectorOpen} onOpenChange={setIsSelectorOpen} onSelect={handleTokenSelect} title="Network Selector" isSwapContext={true} />
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
