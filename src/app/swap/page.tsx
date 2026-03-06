
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
  History,
  Zap,
  Settings2,
  Workflow,
  CheckCircle2,
  ShieldAlert,
  Globe,
  Activity,
  Repeat,
  AlertCircle,
  X
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
import { determineSwapProvider, needsPivotRoute, getRouteDescription, type SwapProvider } from '@/lib/services/swap-router';
import { zeroXService } from '@/lib/services/zerox-service';
import { swapExecutionService } from '@/lib/services/swap-execution-service';

interface SwapQuote {
  id: string;
  provider: string;
  logo: string | null;
  receiveAmount: number;
  fee: number;
  eta: string;
  isBest?: boolean;
  rawQuote?: any;
  swapProvider: SwapProvider;
  isPivotRoute?: boolean;
  routeDescription?: string;
}

type QuotePhase = 'IDLE' | 'FETCHING' | 'SHOW_ALL' | 'SCANNING' | 'FINAL_SELECTED' | 'FADING_OUT' | 'SHOW_VISUAL' | 'COMPLETED';
type ExecutionPhase = 'IDLE' | 'VERIFYING' | 'LIQUIDITY' | 'APPROVING' | 'SENDING' | 'SETTLING' | 'SUCCESS' | 'FAILED' | 'PIVOT_CONVERTING' | 'PIVOT_BRIDGING' | 'PIVOT_FINALIZING';

const formatSmartAmount = (val: number) => {
  if (val === 0) return '0.00';
  if (val >= 1) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const str = val.toFixed(10);
  const significantMatch = str.match(/0\.0*[1-9]/);
  if (significantMatch) {
    const leadZeros = significantMatch[0].length - 2;
    return val.toLocaleString(undefined, { 
      minimumFractionDigits: leadZeros, 
      maximumFractionDigits: leadZeros + 2 
    });
  }
  return val.toLocaleString(undefined, { maximumFractionDigits: 6 });
};

function SwapClient() {
  const { viewingNetwork, wallets, allAssets, allChainsMap = {}, prices, infuraApiKey, refresh } = useWallet();
  const { user, profile, refreshProfile } = useUser();
  const { formatFiat } = useCurrency();
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
  
  const [quotePhase, setQuotePhase] = useState<QuotePhase>('IDLE');
  const [activeScanIndex, setActiveScanIndex] = useState<number>(-1);

  const [executionPhase, setExecutionPhase] = useState<ExecutionPhase>('IDLE');
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const [isAdminLiquidityValid, setIsAdminLiquidityValid] = useState<boolean | null>(null);
  const [isCheckingLiquidity, setIsCheckingLiquidity] = useState(false);

  const [rotation, setRotation] = useState(0);
  
  const lastFetchedAmountRef = useRef<string>('');
  const hasInitializedRef = useRef(false);
  const quoteIdRef = useRef<number>(0);

  const isCrossChain = fromToken && toToken && (fromToken.chainId ?? 1) !== (toToken.chainId ?? 1);

  // AUTO-HIDE ERROR SENTINEL
  useEffect(() => {
    if (fetchError) {
      const timer = setTimeout(() => {
        setFetchError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [fetchError]);

  useEffect(() => {
    if (allAssets.length === 0 || hasInitializedRef.current) return;
    const initialFrom = allAssets.find(a => a.symbol !== 'WNC') || allAssets[0];
    const initialTo = allAssets.find(a => a.symbol !== initialFrom?.symbol && a.symbol !== 'WNC') || allAssets[allAssets.length - 1];
    if (initialFrom) setFromToken({ ...initialFrom });
    if (initialTo) setToToken({ ...initialTo });
    hasInitializedRef.current = true;
  }, [allAssets]);

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

  useEffect(() => {
    if (!toToken || !selectedQuoteId) return;
    
    const checkLiquidity = async () => {
      const quote = quotes.find(q => q.id === selectedQuoteId);
      if (!quote) return;

      setIsCheckingLiquidity(true);
      const targetChain = allChainsMap[toToken.chainId];
      const isValid = await swapExecutionService.checkAdminLiquidity(
        targetChain, 
        toToken, 
        quote.receiveAmount, 
        infuraApiKey
      );
      setIsAdminLiquidityValid(isValid);
      setIsCheckingLiquidity(false);
    };

    checkLiquidity();
  }, [selectedQuoteId, toToken, quotes, allChainsMap, infuraApiKey]);

  useEffect(() => {
    const runSequence = async () => {
      const currentQuoteId = ++quoteIdRef.current;

      if (!debouncedAmount || parseFloat(debouncedAmount) <= 0) {
        setQuotes([]); setQuotePhase('IDLE'); setSelectedQuoteId(null); setFetchError(null); setActiveScanIndex(-1);
        setIsAdminLiquidityValid(null);
        lastFetchedAmountRef.current = ''; return;
      }
      if (!fromToken || !toToken) return;

      const currentSignature = `${fromToken.chainId}:${fromToken.address}:${toToken.chainId}:${toToken.address}:${debouncedAmount}`;
      if (currentSignature === lastFetchedAmountRef.current) return;
      lastFetchedAmountRef.current = currentSignature;
      
      const restriction = checkPairRestriction(fromToken.symbol, toToken.symbol);
      if (restriction.isRestricted) {
        setFetchError(restriction.message!);
        setQuotePhase('IDLE');
        return;
      }

      setIsQuoteLoading(true); 
      setQuotePhase('FETCHING'); 
      setFetchError(null); 
      setActiveScanIndex(-1); 
      setSelectedQuoteId(null);
      setIsAdminLiquidityValid(null);
      
      try {
        const tradeValueUsd = parseFloat(debouncedAmount) * (fromTokenPrice || 0);
        const userAddress = wallets?.[0]?.address || '0x0000000000000000000000000000000000000000';
        
        const providerType = determineSwapProvider(
            fromToken.chainId ?? 1, 
            toToken.chainId ?? 1, 
            fromToken.symbol, 
            toToken.symbol
        );

        const isPivotRequired = needsPivotRoute(
            fromToken.chainId ?? 1,
            toToken.chainId ?? 1,
            fromToken.symbol,
            toToken.symbol,
            providerType,
            fromToken.isNative,
            toToken.isNative
        );
        
        let quote: SwapQuote | null = null;

        if (providerType === 'ZEROX') {
            const sellAmount = ethers.parseUnits(debouncedAmount, fromToken.decimals || 18).toString();
            
            // INSTITUTIONAL SYMBOL MAPPING: 0x v1 Price Discovery prefers symbols for native assets
            const sellId = fromToken.isNative ? fromToken.symbol : fromToken.address;
            const buyId = toToken.isNative ? toToken.symbol : toToken.address;

            const p = await zeroXService.getPrice(fromToken.chainId ?? 1, sellId, buyId, sellAmount, userAddress);
            
            const gasCostEth = (parseFloat(p.estimatedGas || '21000') * parseFloat(p.gasPrice || '1000000000')) / 1e18;
            const gasCostUsd = gasCostEth * (prices['ethereum']?.price || 2500);

            quote = {
                id: '0x-node',
                provider: '0x Node',
                logo: null,
                receiveAmount: parseFloat(ethers.formatUnits(p.buyAmount, toToken.decimals || 18)),
                fee: gasCostUsd + 0.10,
                eta: '~10s',
                rawQuote: p,
                swapProvider: 'ZEROX',
                routeDescription: getRouteDescription(fromToken.symbol, toToken.symbol, 'ZEROX', false)
            };
        } 
        else if (providerType === 'LIFI') {
            const params = new URLSearchParams({ 
                fromChain: (fromToken.chainId ?? 1).toString(), 
                toChain: (toToken.chainId ?? 1).toString(), 
                fromToken: fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address, 
                toToken: toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address, 
                fromAmount: ethers.parseUnits(debouncedAmount, fromToken.decimals || 18).toString(), 
                fromAddress: userAddress, 
                slippage: '0.005' 
            });
            
            const res = await fetch(`/api/bridge/quote?${params.toString()}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.details || err.error || "Bridge Protocol Failed.");
            }
            const q = await res.json();

            const platformFeeUsd = tradeValueUsd * 0.01;
            const receiveAmountReduction = platformFeeUsd / (toTokenPrice || 1);
            const rawReceive = parseFloat(ethers.formatUnits(q.estimate.toAmount, toToken.decimals || 18));

            quote = {
                id: 'lifi-node',
                provider: q.tool?.toUpperCase().slice(0, 10) || 'Bridge',
                logo: null,
                receiveAmount: Math.max(0, rawReceive - receiveAmountReduction),
                fee: parseFloat(q.estimate.feeCosts?.[0]?.amountUsd || '2.00') + 0.10 + platformFeeUsd,
                eta: `~${Math.ceil((q.estimate.executionDuration || 60) / 60)}m`,
                rawQuote: q,
                swapProvider: 'LIFI',
                routeDescription: getRouteDescription(fromToken.symbol, toToken.symbol, 'LIFI', false)
            };
        }
        else {
            const feeData = await calculateSwapFees(tradeValueUsd, fromToken.name, toToken.name);
            const divisor = toTokenPrice || 1;
            const estAmt = (parseFloat(debouncedAmount) * (fromTokenPrice || 0)) / divisor;
            const finalReceive = Math.max(0, estAmt - (feeData.networkFee / divisor));

            quote = {
                id: 'internal-vault',
                provider: isPivotRequired ? 'USDC Bridge' : 'Sync Node',
                logo: null,
                receiveAmount: finalReceive,
                fee: feeData.networkFee,
                eta: isPivotRequired ? '~45s' : '~10s',
                swapProvider: 'INTERNAL',
                isPivotRoute: isPivotRequired,
                routeDescription: getRouteDescription(fromToken.symbol, toToken.symbol, 'INTERNAL', isPivotRequired)
            };
        }

        if (currentQuoteId !== quoteIdRef.current || !quote) return;
        setQuotes([quote]); 
        setIsQuoteLoading(false); 
        setQuotePhase('SHOW_ALL'); 
        await new Promise(r => setTimeout(r, 200)); 
        setQuotePhase('SCANNING');
        setActiveScanIndex(0); 
        await new Promise(r => setTimeout(r, 200)); 
        setQuotePhase('FINAL_SELECTED'); 
        setSelectedQuoteId(quote.id); 
        await new Promise(r => setTimeout(r, 300)); 
        setQuotePhase('SHOW_VISUAL'); 
        await new Promise(r => setTimeout(r, 400)); 
        setQuotePhase('COMPLETED');

      } catch (e: any) { 
        if (currentQuoteId === quoteIdRef.current) {
            setFetchError(e.message || "Handshake Aborted."); 
            setQuotePhase('IDLE'); 
        }
      } finally { 
        if (currentQuoteId === quoteIdRef.current) setIsQuoteLoading(false); 
      }
    };
    runSequence();
  }, [debouncedAmount, fromToken, toToken, prices, fromTokenPrice, toTokenPrice, infuraApiKey, allChainsMap, wallets]);

  const selectedQuote = useMemo(() => quotes.find(q => q.id === selectedQuoteId), [quotes, selectedQuoteId]);

  const handleExecuteSwap = async () => {
    if (!selectedQuote || !fromToken || !toToken || !user || !wallets || !infuraApiKey || isAdminLiquidityValid === false) return;
    
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionPhase('VERIFYING');
    
    try {
      const balance = parseFloat(fromToken.balance || '0');
      if (balance < parseFloat(amount)) throw new Error("Funds low.");
      
      const chainConfig = allChainsMap[fromToken.chainId ?? 1];
      const evmWallet = wallets.find(w => w.type === 'evm');
      
      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl.replace('{API_KEY}', infuraApiKey), undefined, { staticNetwork: true });
      const wallet = new ethers.Wallet(evmWallet!.privateKey!, provider);

      if (selectedQuote.swapProvider === 'ZEROX') {
          setExecutionPhase('LIQUIDITY');
          const sellAmount = ethers.parseUnits(amount, fromToken.decimals || 18).toString();
          
          const sellId = fromToken.isNative ? fromToken.symbol : fromToken.address;
          const buyId = toToken.isNative ? toToken.symbol : toToken.address;

          const q = await zeroXService.getQuote(fromToken.chainId ?? 1, sellId, buyId, sellAmount, wallet.address);
          
          if (!fromToken.isNative) {
              setExecutionPhase('APPROVING');
              const tokenContract = new ethers.Contract(fromToken.address, ["function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)"], wallet);
              const allowance = await tokenContract.allowance(wallet.address, q.allowanceTarget);
              if (allowance < ethers.parseUnits(amount, fromToken.decimals || 18)) {
                  const approveTx = await tokenContract.approve(q.allowanceTarget, ethers.MaxUint256);
                  await approveTx.wait();
              }
          }

          setExecutionPhase('SENDING');
          const tx = await wallet.sendTransaction({ to: q.to, data: q.data, value: q.value, gasLimit: q.gas });
          setExecutionPhase('SETTLING');
          await tx.wait();
      } 
      else if (selectedQuote.swapProvider === 'LIFI') {
          setExecutionPhase('LIQUIDITY');
          const q = selectedQuote.rawQuote;
          if (q.transactionRequest) {
              setExecutionPhase('APPROVING');
              const approvalAddress = q.estimate.approvalAddress;
              if (approvalAddress && !fromToken.isNative) {
                  const tokenContract = new ethers.Contract(fromToken.address, ["function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)"], wallet);
                  const allowance = await tokenContract.allowance(wallet.address, approvalAddress);
                  if (allowance < ethers.parseUnits(amount, fromToken.decimals || 18)) {
                      const approveTx = await tokenContract.approve(approvalAddress, ethers.MaxUint256);
                      await approveTx.wait();
                  }
              }
              setExecutionPhase('SENDING');
              const tx = await wallet.sendTransaction({ to: q.transactionRequest.to, data: q.transactionRequest.data, value: q.transactionRequest.value, gasLimit: q.transactionRequest.gasLimit });
              setExecutionPhase('SETTLING');
              await tx.wait();
          }
      }
      else if (selectedQuote.swapProvider === 'INTERNAL') {
          if (selectedQuote.isPivotRoute) setExecutionPhase('PIVOT_CONVERTING');
          else setExecutionPhase('LIQUIDITY');

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
          if (!handshake.success) throw new Error(handshake.error || "Denied.");

          if (selectedQuote.isPivotRoute) setExecutionPhase('PIVOT_BRIDGING');
          else setExecutionPhase('SENDING');

          let userTx;
          if (fromToken.isNative) {
            userTx = await wallet.sendTransaction({ to: handshake.adminAddress, value: ethers.parseEther(amount) });
          } else {
            const contract = new ethers.Contract(fromToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet);
            userTx = await contract.transfer(handshake.adminAddress, ethers.parseUnits(amount, fromToken.decimals || 18));
          }
          
          setExecutionPhase('SETTLING');
          const receipt = await userTx.wait();
          
          if (selectedQuote.isPivotRoute) setExecutionPhase('PIVOT_FINALIZING');

          await fetch('/api/swap/finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ swapId: handshake.swapId, txHash: receipt.hash })
          });
      }

      setExecutionPhase('SUCCESS');
      await refreshProfile(); refresh();
      setTimeout(() => { setIsExecuting(false); setAmount(''); router.push('/profile'); }, 3000);

    } catch (e: any) {
      setExecutionError(e.message || "Handshake Aborted.");
      setExecutionPhase('FAILED');
      setTimeout(() => setIsExecuting(false), 4000);
    }
  };

  const handleOpenSelector = (type: 'from' | 'to') => {
    setSelectionType(type);
    setIsSelectorOpen(true);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken({ ...token });
    else setToToken({ ...token });
    setQuotes([]); setQuotePhase('IDLE'); setSelectedQuoteId(null); setFetchError(null); lastFetchedAmountRef.current = '';
    setIsAdminLiquidityValid(null);
  };

  const handleSwapTokens = () => {
    if (!fromToken || !toToken) return;
    setRotation(prev => prev + 180); 
    const oldFrom = { ...fromToken }; const oldTo = { ...toToken };
    setFromToken(oldTo); setToToken(oldFrom);
    setQuotes([]); setQuotePhase('IDLE'); setSelectedQuoteId(null); setFetchError(null); lastFetchedAmountRef.current = '';
    setIsAdminLiquidityValid(null);
  };

  const fromChainColor = fromToken ? (allChainsMap?.[fromToken.chainId ?? 1]?.themeColor || '#818cf8') : '#818cf8';
  const toChainColor = toToken ? (allChainsMap?.[toToken.chainId ?? 1]?.themeColor || '#818cf8') : '#818cf8';

  const infoItems = [
    { label: 'Route', value: selectedQuote?.provider || 'Sync', icon: Workflow },
    { label: 'Gas', value: `$${selectedQuote?.fee.toFixed(2) || '0.10'}`, icon: Fuel },
    { label: 'Time', value: selectedQuote?.eta || '~15s', icon: History },
    { label: 'Safe', value: 'Yes', icon: ShieldCheck }
  ];

  const canExecute = quotePhase === 'COMPLETED' && !isExecuting && isAdminLiquidityValid === true;

  return (
    <div className="flex flex-col min-h-full bg-[#050505] text-foreground relative overflow-hidden">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex flex-col items-center text-center">
            <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none">{isCrossChain ? 'Bridge' : 'Swap'}</h1>
            <div className="flex items-center gap-1.5 mt-1.5"><ShieldCheck className="w-2.5 h-2.5 text-primary" /><span className="text-[8px] text-primary font-black uppercase tracking-tighter">Verified Router</span></div>
        </div>
        <Button variant="ghost" size="icon"><Settings2 className="w-5 h-5 text-muted-foreground" /></Button>
      </header>

      {/* INSTITUTIONAL LIQUIDITY WARNING */}
      <AnimatePresence>
        {isAdminLiquidityValid === false && !isExecuting && (
          <motion.div 
            initial={{ y: -150, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: -150, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[110] p-4 bg-black/90 backdrop-blur-3xl border-b border-red-500/30 shadow-2xl"
          >
            <div className="max-w-lg mx-auto flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/30">
                <ShieldAlert className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Liquidity Restricted</p>
                <p className="text-xs font-bold text-red-400/80 leading-tight">
                  This route is currently locked due to insufficient node liquidity.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsAdminLiquidityValid(null)} className="rounded-full">
                <X className="w-4 h-4 text-white/20" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXECUTE SWAP BUTTON */}
      <AnimatePresence>
        {canExecute && (
          <motion.div 
            initial={{ y: -150, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: -150, opacity: 0 }} 
            className="fixed top-0 left-0 right-0 z-[120] p-4 bg-black/80 backdrop-blur-2xl border-b border-primary/20 shadow-2xl"
          >
            <div className="max-w-lg mx-auto">
              <Button 
                className="w-full h-16 rounded-[2rem] text-base font-black shadow-2xl transition-all border-b-4 bg-primary hover:bg-primary/90 border-primary/50 text-white relative overflow-hidden group uppercase tracking-[0.2em]" 
                onClick={handleExecuteSwap}
              >
                <span className="relative z-10 flex items-center justify-center gap-3"><ShieldCheck className="w-6 h-6" />Authorize Handshake</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full space-y-1 pb-40 pt-6 px-4 relative z-10 overflow-y-auto thin-scrollbar">
        <section style={{ backgroundColor: `${fromChainColor}40`, borderColor: `${fromChainColor}cc`, boxShadow: `0 0 60px ${fromChainColor}40, inset 0 0 20px ${fromChainColor}20` }} className="w-full border p-4 rounded-[2.5rem] space-y-1 relative transition-all duration-500 h-[125px] flex flex-col justify-center overflow-hidden">
          <div className="flex items-center justify-between h-10 shrink-0 relative">
            <button onClick={() => handleOpenSelector('from')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-1 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={20} chainId={fromToken?.chainId} symbol={fromToken?.symbol} name={fromToken?.name} />
                <span className="font-black text-[10px] text-white uppercase tracking-tighter">{fromToken?.symbol}</span>
                <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
            <span className="text-[7px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">{fromToken?.name}</span>
          </div>
          <div className="relative flex-1 flex flex-col justify-center">
            <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-2xl font-black bg-transparent border-none p-0 h-auto focus-visible:ring-0 placeholder:text-zinc-800 tracking-tighter text-white" />
            <div className="mt-0.5"><span className="text-[9px] font-black text-white/40 uppercase tracking-widest">≈ {formatFiat(parseFloat(amount || '0') * fromTokenPrice)}</span></div>
          </div>
        </section>

        <div className="relative h-6 flex items-center justify-center z-20">
          <motion.button animate={{ rotate: rotation }} transition={{ type: 'spring', damping: 15 }} onClick={handleSwapTokens} className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-primary shadow-2xl active:scale-90 transition-transform">
            <Zap className="w-5 h-5 fill-current" />
          </motion.button>
        </div>

        <section style={{ backgroundColor: `${toChainColor}40`, borderColor: `${toChainColor}cc`, boxShadow: `0 0 60px ${toChainColor}40, inset 0 0 20px ${toChainColor}20` }} className="w-full border p-4 rounded-[2.5rem] space-y-1 relative transition-all duration-500 h-[125px] flex flex-col justify-center overflow-hidden">
          <div className="flex items-center justify-between h-10 shrink-0 relative">
            <button onClick={() => handleOpenSelector('to')} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-3 py-1 rounded-full border border-white/10 transition-all">
                <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={20} chainId={toToken?.chainId} symbol={toToken?.symbol} name={toToken?.name} />
                <span className="font-black text-[10px] text-white uppercase tracking-tighter">{toToken?.symbol}</span>
                <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
            <span className="text-[7px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">{toToken?.name}</span>
          </div>
          <div className="relative flex-1 flex flex-col justify-center">
            <div className="text-2xl font-black tracking-tighter text-white flex flex-col">
              {isQuoteLoading && !selectedQuote ? <Skeleton className="h-8 w-24 bg-white/10 rounded" /> : (
                <>
                  <motion.span key={selectedQuoteId || 'empty'} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums">
                    {selectedQuote ? formatSmartAmount(selectedQuote.receiveAmount) : '0.00'}
                  </motion.span>
                  <div className="mt-0.5"><span className="text-[9px] font-black text-white/40 uppercase tracking-widest">≈ {formatFiat((selectedQuote?.receiveAmount || 0) * toTokenPrice)}</span></div>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="mt-6 px-4 grid grid-cols-2 gap-2">
          {(quotePhase === 'SHOW_VISUAL' || quotePhase === 'COMPLETED') && infoItems.map((item, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><item.icon className="w-3 h-3" /></div><span className="text-[7px] font-black uppercase text-muted-foreground tracking-widest">{item.label}</span></div>
              <span className="text-[9px] font-black text-white">{item.value}</span>
            </motion.div>
          ))}
        </div>

        <div className="relative mt-8 w-full min-h-[160px]">
          <AnimatePresence>
            {(quotePhase === 'SHOW_VISUAL' || quotePhase === 'COMPLETED') && (
              <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="p-5 bg-white/[0.03] border border-white/5 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 relative z-10 py-1">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative p-1.5"><motion.div animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} style={{ borderColor: `${fromChainColor}66` }} className="absolute inset-0 rounded-full border border-dashed" /><div className="relative z-[70] bg-black rounded-full p-1 border border-white/5 w-10 h-10 flex items-center justify-center"><TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt="from" size={32} chainId={fromToken?.chainId} symbol={fromToken?.symbol} name={fromToken?.name} /></div></div>
                    <p className="text-[9px] font-black text-white uppercase">{fromToken?.symbol}</p>
                  </div>

                  <div className="flex-1 px-1 relative h-3 overflow-hidden">
                    <svg width="100%" height="2" className="absolute top-1/2 -translate-y-1/2">
                      <line x1="0" y1="1" x2="100%" y2="1" stroke={fromChainColor} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="6" />
                      <motion.line x1="0" y1="1" x2="100%" y2="1" stroke={fromChainColor} strokeWidth="1" strokeDasharray="12" animate={{ strokeDashoffset: [24, 0] }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }} />
                    </svg>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="relative p-3 rounded-full bg-primary/10 border border-primary/20">
                      {selectedQuote?.isPivotRoute ? (
                        <div className="relative"><TokenLogoDynamic symbol="USDC" name="USD Coin" logoUrl={null} size={24} className="opacity-80" alt="pivot" /><motion.div animate={{ scale: [1, 1.15, 1], rotate: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute -inset-2 rounded-full border border-dashed border-primary/30" /></div>
                      ) : (
                        <><Activity className="w-6 h-6 text-primary" /><motion.div animate={{ scale: [1, 1.15, 1], rotate: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-full border border-dashed border-primary/30" /></>
                      )}
                    </div>
                    <span className="text-[7px] font-black text-primary uppercase tracking-widest">{selectedQuote?.isPivotRoute ? 'Bridge' : 'Sync'}</span>
                  </div>

                  <div className="flex-1 px-1 relative h-3 overflow-hidden">
                    <svg width="100%" height="2" className="absolute top-1/2 -translate-y-1/2">
                      <line x1="0" y1="1" x2="100%" y2="1" stroke={toChainColor} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="6" />
                      <motion.line x1="0" y1="1" x2="100%" y2="1" stroke={toChainColor} strokeWidth="1" strokeDasharray="12" animate={{ strokeDashoffset: [24, 0] }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }} />
                    </svg>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="relative p-1.5"><motion.div animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} style={{ borderColor: `${toChainColor}66` }} className="absolute inset-0 rounded-full border border-dashed" /><div className="relative z-[70] bg-black rounded-full p-1 border border-white/5 w-10 h-10 flex items-center justify-center"><TokenLogoDynamic logoUrl={toToken?.iconUrl} alt="to" size={32} chainId={toToken?.chainId} symbol={toToken?.symbol} name={toToken?.name} /></div></div>
                    <p className="text-[9px] font-black text-white uppercase">{toToken?.symbol}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* QUOTE SYNC STATUS */}
      <AnimatePresence>
        {(quotePhase !== 'IDLE' && quotePhase !== 'SHOW_VISUAL' && quotePhase !== 'COMPLETED' || fetchError) && (
          <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-24 left-4 right-4 z-[90] max-w-lg mx-auto pointer-events-none">
            <div className="bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden relative pointer-events-auto">
              <div className="relative z-10 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isQuoteLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : fetchError ? <ShieldAlert className="w-4 h-4 text-red-500" /> : <Globe className="w-4 h-4 text-primary" />}
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">Node Sync</h3>
                  </div>
                  {fetchError && (
                    <button onClick={() => setFetchError(null)} className="p-1 rounded-full hover:bg-white/5 transition-colors">
                      <X className="w-4 h-4 text-white/20" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {fetchError ? (
                    <div className="p-6 rounded-[2rem] bg-[#050505] border border-red-500/40 text-center space-y-4">
                        <p className="text-xs font-bold text-red-400 leading-relaxed px-2">{fetchError}</p>
                        <Button size="sm" variant="ghost" className="h-9 rounded-xl text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 text-white" onClick={() => { lastFetchedAmountRef.current = ''; setAmount(amount); }}>Re-sync</Button>
                    </div>
                  ) : isQuoteLoading ? (
                    <div className="space-y-2">{[1].map(i => <Skeleton key={i} className="h-14 bg-white/5 rounded-2xl animate-pulse" />)}</div>
                  ) : (
                    <div className="space-y-2">
                      {quotes.map((quote, idx) => {
                        const isBest = quotePhase === 'FINAL_SELECTED' && quote.id === selectedQuoteId;
                        return (
                          <motion.div key={quote.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1 }} className={cn("w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300", isBest ? "border-primary bg-primary/10 scale-105" : "border-white/5 bg-white/[0.02]")}>
                            <div className="flex items-center gap-3 relative z-10">
                              <div className={cn("w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center font-black text-xs text-white uppercase", isBest ? "bg-primary shadow-lg" : "bg-zinc-900")}>{isBest ? <CheckCircle2 className="w-5 h-5" /> : quote.provider[0]}</div>
                              <div className="text-left">
                                <p className="text-xs font-black text-white">{quote.provider}</p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">{quote.routeDescription}</p>
                              </div>
                            </div>
                            <div className="text-right"><p className={cn("text-sm font-black tabular-nums transition-colors", isBest ? "text-primary" : "text-white")}>{formatSmartAmount(quote.receiveAmount)}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">{toToken?.symbol}</p></div>
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

      <GlobalTokenSelector isOpen={isSelectorOpen} onOpenChange={setIsSelectorOpen} onSelect={handleTokenSelect} title="Sync Node" isSwapContext={true} />
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
