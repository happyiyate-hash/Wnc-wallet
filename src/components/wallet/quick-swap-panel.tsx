
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { useCurrency } from '@/contexts/currency-provider';
import { 
  Plane, 
  Timer, 
  Fuel, 
  Loader2, 
  X, 
  Zap, 
  ChevronDown,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import type { AssetRow } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import GlobalTokenSelector from '../shared/global-token-selector';
import { calculateSwapFees, checkPairRestriction } from '@/lib/services/swap-fee-calculator';
import { useToast } from '@/hooks/use-toast';

interface QuickSwapPanelProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

/**
 * INSTITUTIONAL QUICK SWAP PANEL
 * Version: 2.1.0 (Logo Precision Patch)
 * Features real-time fee handshakes and background execution.
 */
export default function QuickSwapPanel({ isOpen, onOpenChange }: QuickSwapPanelProps) {
  const { allAssets, wallets, infuraApiKey, allChainsMap, prices, refresh, getAddressForChain } = useWallet();
  const { user, profile, refreshProfile } = useUser();
  const { formatFiat } = useCurrency();
  const { toast } = useToast();

  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');

  // Sync initial tokens if not set
  useEffect(() => {
    if (isOpen && allAssets.length >= 2 && !fromToken) {
        const initialFrom = allAssets.find(a => a.symbol !== 'WNC') || allAssets[0];
        setFromToken(initialFrom);
        setToToken(allAssets.find(a => a.symbol !== initialFrom.symbol && a.symbol !== 'WNC') || allAssets[1]);
    }
  }, [isOpen, allAssets, fromToken]);

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

  /**
   * ATOMIC QUOTE HANDSHAKE
   */
  useEffect(() => {
    const fetchQuickQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0) {
        setQuote(null);
        setFetchError(null);
        return;
      }

      // 1. Check Pair Restriction
      const restriction = checkPairRestriction(fromToken.symbol, toToken.symbol);
      if (restriction.isRestricted) {
        setFetchError(restriction.message!);
        setQuote(null);
        return;
      }

      setIsQuoteLoading(true);
      setFetchError(null);

      try {
        const tradeValueUsd = parseFloat(debouncedAmount) * (fromTokenPrice || 0.000001);
        
        // 2. Institutional Fee Handshake
        const feeData = await calculateSwapFees(tradeValueUsd, allChainsMap[fromToken.chainId]?.type || 'evm');
        
        // 3. Estimate Output (Direct Math for Quick Panel)
        const divisor = toTokenPrice || 1;
        const estAmt = (parseFloat(debouncedAmount) * (fromTokenPrice || 0)) / divisor;
        const finalAmt = Math.max(0, estAmt - (feeData.networkFee / divisor));

        setQuote({
          receiveAmount: finalAmt,
          feeUsd: feeData.networkFee,
          provider: 'Institutional Route'
        });
      } catch (e: any) {
        setFetchError("Sync Failure");
      } finally {
        setIsQuoteLoading(false);
      }
    };

    fetchQuickQuote();
  }, [debouncedAmount, fromToken, toToken, allChainsMap, fromTokenPrice, toTokenPrice]);

  /**
   * INSTITUTIONAL EXECUTION HANDSHAKE
   */
  const handleExecuteSwap = async () => {
    if (!quote || !fromToken || !toToken || !user || !wallets || !infuraApiKey) return;
    
    setIsExecuting(true);
    
    try {
      // 1. Balance Check
      const balance = parseFloat(fromToken.balance || '0');
      if (balance < parseFloat(amount)) throw new Error("Insufficient Funds.");

      // 2. Liquidity Handshake (Backend Registry Lock)
      const handshakeRes = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromChain: fromToken.name,
          toChain: toToken.name,
          fromSymbol: fromToken.symbol,
          toSymbol: toToken.symbol,
          fromAmount: parseFloat(amount),
          fromTokenPriceUsd: fromTokenPrice,
          toAmountExpected: quote.receiveAmount,
          adminFeeUsd: quote.feeUsd * 0.5,
          networkFeeUsd: quote.feeUsd * 0.5,
          recipientAddress: getAddressForChain(allChainsMap[toToken.chainId], wallets)
        })
      });

      const handshake = await handshakeRes.json();
      if (!handshake.success) throw new Error(handshake.error || "Handshake Rejected.");

      // 3. User Dispatch (Leg 1)
      const chainConfig = allChainsMap[fromToken.chainId];
      const evmWallet = wallets.find(w => w.type === 'evm');
      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl.replace('{API_KEY}', infuraApiKey), undefined, { staticNetwork: true });
      const wallet = new ethers.Wallet(evmWallet!.privateKey!, provider);
      
      if (fromToken.isNative) {
        await wallet.sendTransaction({ to: handshake.adminAddress, value: ethers.parseEther(amount) });
      } else {
        const contract = new ethers.Contract(fromToken.address, ["function transfer(address to, uint256 amount) returns (bool)"], wallet);
        await contract.transfer(handshake.adminAddress, ethers.parseUnits(amount, fromToken.decimals || 18));
      }

      toast({ title: "Swap Authorized", description: "Ledger settlement in progress." });
      
      // Atomic Cleanup
      setTimeout(async () => {
        await refreshProfile(); 
        refresh();
        setIsExecuting(false);
        onOpenChange(false);
        setAmount('');
      }, 2000);

    } catch (e: any) {
      toast({ variant: "destructive", title: "Execution Failed", description: e.message });
      setIsExecuting(false);
    }
  };

  const handleOpenSelector = (type: 'from' | 'to') => {
    setSelectionType(type);
    setIsSelectorOpen(true);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setQuote(null);
  };

  const fromChainColor = fromToken ? (allChainsMap[fromToken.chainId]?.themeColor || '#818cf8') : '#818cf8';

  return (
    <>
        <div className={cn("fixed top-3 left-2 right-2 z-[100] transition-all duration-500 ease-in-out pointer-events-none", isOpen ? "translate-y-0 opacity-100" : "-translate-y-[150%] opacity-0")}>
            <div style={{ boxShadow: `0 8px 40px -10px ${fromChainColor}60`, borderColor: `${fromChainColor}40`, backgroundColor: '#050505' }} className="border rounded-[2rem] p-3.5 max-w-lg mx-auto pointer-events-auto shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2 bg-primary/10 px-3 py-0.5 rounded-full border border-primary/20">
                        <Zap className="w-2.5 h-2.5 text-primary fill-primary" />
                        <span className="text-[7px] font-black uppercase tracking-[0.15em] text-primary">QUICK SETTLE</span>
                    </div>
                    <button onClick={() => onOpenChange(false)} className="p-1 rounded-full hover:bg-white/10 transition-colors"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                    {/* PAY SLOT */}
                    <div className="flex-1 flex items-center bg-white/[0.03] border border-white/5 rounded-xl h-10 px-3 gap-2">
                        <button onClick={() => handleOpenSelector('from')} className="shrink-0 active:scale-90 transition-all">
                            <TokenLogoDynamic 
                              logoUrl={fromToken?.iconUrl} 
                              alt={fromToken?.symbol || ''} 
                              size={22} 
                              chainId={fromToken?.chainId} 
                              symbol={fromToken?.symbol} 
                              name={fromToken?.name}
                            />
                        </button>
                        <Input 
                            type="number" 
                            placeholder="0.00" 
                            value={amount} 
                            onChange={(e) => setAmount(e.target.value)} 
                            className="bg-transparent border-none text-xs font-black p-0 h-auto focus-visible:ring-0 text-white placeholder:text-zinc-800" 
                        />
                    </div>

                    <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
                        <Plane className="w-3 h-3 text-primary" />
                    </div>

                    {/* RECEIVE SLOT */}
                    <div className="flex-1 flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl h-10 px-3 gap-2 overflow-hidden">
                        {isQuoteLoading && !quote ? (
                            <Skeleton className="h-3 w-16 bg-white/10 rounded" />
                        ) : fetchError ? (
                            <AlertCircle className="w-3 h-3 text-red-500" />
                        ) : (
                            <span className="text-xs font-black tracking-tight tabular-nums truncate text-white">
                                {quote?.receiveAmount ? quote.receiveAmount.toFixed(4) : '0.0000'}
                            </span>
                        )}
                        <button onClick={() => handleOpenSelector('to')} className="shrink-0 active:scale-90 transition-all">
                            <TokenLogoDynamic 
                              logoUrl={toToken?.iconUrl} 
                              alt={toToken?.symbol || ''} 
                              size={22} 
                              chainId={toToken?.chainId} 
                              symbol={toToken?.symbol} 
                              name={toToken?.name}
                            />
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3 text-[8px] font-black uppercase text-muted-foreground/50">
                        <div className="flex items-center gap-1">
                            <Timer className="w-2.5 h-2.5 text-primary" />
                            <span>{quote?.eta || '~10s'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Fuel className="w-2.5 h-2.5 text-primary" />
                            <span>{quote?.feeUsd ? `$${quote.feeUsd.toFixed(2)}` : 'LOW GAS'}</span>
                        </div>
                    </div>
                    
                    <Button 
                        size="sm" 
                        className={cn(
                            "h-7 px-4 rounded-xl font-black text-[8px] uppercase tracking-widest",
                            isExecuting ? "bg-zinc-800" : "bg-primary hover:bg-primary/90"
                        )} 
                        disabled={!amount || isQuoteLoading || !!fetchError || isExecuting}
                        onClick={handleExecuteSwap}
                    >
                        {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : "EXECUTE"}
                    </Button>
                </div>

                {fetchError && (
                    <div className="mt-2 px-1 flex items-center gap-1.5">
                        <AlertCircle className="w-2.5 h-2.5 text-red-500" />
                        <span className="text-[7px] font-bold text-red-400 uppercase truncate">{fetchError}</span>
                    </div>
                )}
            </div>
        </div>

        <GlobalTokenSelector 
            isOpen={isSelectorOpen}
            onOpenChange={setIsSelectorOpen}
            onSelect={handleTokenSelect}
            title="Switch Network"
            isSwapContext={true}
        />
    </>
  );
}
