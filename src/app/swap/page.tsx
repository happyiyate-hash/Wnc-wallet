
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  ArrowUpDown, 
  Loader2, 
  ChevronRight,
  Route as RouteIcon,
  Settings2,
  AlertCircle,
  Clock,
  Fuel
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getInitialAssets } from '@/lib/wallets/balances';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { getAddressForChain } from '@/lib/wallets/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LIFI_SUPPORTED_CHAINS } from '@/lib/lifiSupportedChains';

export default function SwapPage() {
  const { allChains, viewingNetwork, balances, wallets, infuraApiKey, allAssets } = useWallet();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // UI State
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  const [slippage, setSlippage] = useState('0.5');
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  // Data State
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Initialization - Filtering for supported tokens only
  useEffect(() => {
    if (allAssets.length > 0) {
      if (!fromToken) {
        const fromSymbol = searchParams.get('symbol') || searchParams.get('fromSymbol');
        const chainIdParam = parseInt(searchParams.get('chainId') || '');
        const targetChainId = !isNaN(chainIdParam) ? chainIdParam : viewingNetwork.chainId;
        
        // Find supported default if possible
        const found = allAssets.find(a => 
            a.symbol === fromSymbol && 
            a.chainId === targetChainId && 
            LIFI_SUPPORTED_CHAINS.includes(a.chainId)
        ) || allAssets.find(a => LIFI_SUPPORTED_CHAINS.includes(a.chainId));
        
        if (found) setFromToken({ ...found });
      }
      if (!toToken && fromToken) {
        const found = allAssets.find(a => 
            a.symbol !== fromToken?.symbol && 
            LIFI_SUPPORTED_CHAINS.includes(a.chainId)
        ) || allAssets[allAssets.length - 1];
        if (found) setToToken({ ...found });
      }
    }
  }, [allAssets, searchParams, fromToken, toToken, viewingNetwork.chainId]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey) {
        setQuoteData(null);
        return;
      }

      // GUARD: Block unsupported chains
      if (!LIFI_SUPPORTED_CHAINS.includes(fromToken.chainId) || !LIFI_SUPPORTED_CHAINS.includes(toToken.chainId)) {
        setFetchError("One of the selected networks is not supported by the bridge API.");
        setQuoteData(null);
        return;
      }

      setIsQuoteLoading(true);
      setFetchError(null);
      try {
        const fromAddr = fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address;
        const toAddr = toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address;
        const userAddr = wallets ? getAddressForChain(viewingNetwork, wallets)! : '0x0000000000000000000000000000000000000000';
        
        const params = new URLSearchParams({
          fromChain: fromToken.chainId.toString(),
          toChain: toToken.chainId.toString(),
          fromToken: fromAddr,
          toToken: toAddr,
          fromAmount: ethers.parseUnits(debouncedAmount, 18).toString(),
          fromAddress: userAddr,
          slippage: (parseFloat(slippage) / 100).toString()
        });

        const res = await fetch(`/api/bridge/quote?${params.toString()}`);
        const data = await res.json();
        if (data.error) throw new Error(data.details || data.error);
        setQuoteData(data);
      } catch (e: any) {
        setFetchError(e.message);
        setQuoteData(null);
      } finally {
        setIsQuoteLoading(false);
      }
    };
    fetchQuote();
  }, [debouncedAmount, fromToken, toToken, wallets, viewingNetwork, slippage, infuraApiKey]);

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
  };

  const fromUsdValue = parseFloat(amount || '0') * (fromToken?.priceUsd || 0);
  const toAmount = quoteData ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)) : 0;
  const toUsdValue = toAmount * (toToken?.priceUsd || 0);
  
  const fromBalance = parseFloat(fromToken?.balance || '0');
  const isInsufficient = parseFloat(amount || '0') > fromBalance;

  const buttonLabel = useMemo(() => {
    if (!amount) return 'Enter Amount';
    if (isInsufficient) return 'Insufficient Balance';
    if (isQuoteLoading) return 'Finding Best Route...';
    if (fetchError) return 'Error - Adjust Selection';
    return 'Review Swap Details';
  }, [amount, isInsufficient, isQuoteLoading, fetchError]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col items-center">
            <h1 className="text-sm font-black uppercase tracking-widest">Bridge & Swap</h1>
            <span className="text-[10px] text-primary font-bold">Best Price via LI.FI</span>
        </div>
        <Button variant="ghost" size="icon">
          <Settings2 className="w-5 h-5 text-muted-foreground" />
        </Button>
      </header>

      <main className="flex-1 p-4 max-lg mx-auto w-full space-y-4 overflow-y-auto pb-32">
        {/* FROM SECTION */}
        <div className="p-6 rounded-2xl bg-secondary/30 border border-white/5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You Pay</span>
            <span className="text-[10px] font-bold text-muted-foreground/60">Balance: {fromBalance.toFixed(4)}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
                <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="text-4xl font-black bg-transparent border-none p-0 h-auto focus-visible:ring-0" 
                />
                <p className="text-xs font-bold text-muted-foreground mt-1">≈ ${fromUsdValue.toFixed(2)}</p>
            </div>
            <Button variant="outline" className="h-14 gap-2" onClick={() => { setSelectionType('from'); setIsNetworkSheetOpen(true); }}>
              <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={32} chainId={fromToken?.chainId} name={fromToken?.name} symbol={fromToken?.symbol} />
              <span className="font-black">{fromToken?.symbol}</span>
            </Button>
          </div>
        </div>

        {/* TO SECTION */}
        <div className="p-6 rounded-2xl bg-secondary/30 border border-white/5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You Receive Est.</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
                <div className="text-4xl font-black">
                    {isQuoteLoading ? <Loader2 className="animate-spin" /> : (toAmount > 0 ? toAmount.toFixed(6) : '0.00')}
                </div>
                <p className="text-xs font-bold text-muted-foreground mt-1">≈ ${toUsdValue.toFixed(2)}</p>
            </div>
            <Button variant="outline" className="h-14 gap-2" onClick={() => { setSelectionType('to'); setIsNetworkSheetOpen(true); }}>
              <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={32} chainId={toToken?.chainId} name={toToken?.name} symbol={toToken?.symbol} />
              <span className="font-black">{toToken?.symbol}</span>
            </Button>
          </div>
        </div>

        {/* QUOTE VISUALS */}
        {quoteData && (
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span className="flex items-center gap-2"><RouteIcon className="w-3.5 h-3.5 text-primary"/> Execution Route</span>
                    <span className="text-primary">{quoteData.tool}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> Est. Time
                        </p>
                        <p className="text-xs font-bold">~{Math.ceil(quoteData.estimate.executionDuration / 60) || 2} min</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1.5 justify-end">
                            <Fuel className="w-3 h-3" /> Network Fee
                        </p>
                        <p className="text-xs font-bold text-white">${parseFloat(quoteData.estimate.gasCosts?.[0]?.amountUsd || '0').toFixed(2)}</p>
                    </div>
                </div>
            </div>
        )}

        {fetchError && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 mt-4">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-black text-destructive">Routing Issue</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{fetchError}</p>
                </div>
            </div>
        )}

        <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto">
            <Button 
                className={cn(
                    "w-full h-16 rounded-[1.5rem] font-black text-lg shadow-xl",
                    isInsufficient ? "bg-destructive hover:bg-destructive" : ""
                )} 
                disabled={!quoteData || isQuoteLoading || isInsufficient}
            >
                {buttonLabel}
            </Button>
        </div>
      </main>

      {/* NETWORK SELECTOR (FILTERED) */}
      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[#0a0a0c]/60 backdrop-blur-3xl -z-10" />
            <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />

            <div className="flex flex-col h-full relative z-10">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                <SheetHeader className="mb-6 px-6 shrink-0">
                    <SheetTitle className="text-2xl font-black text-center uppercase tracking-widest">Select Network</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6 pb-12">
                    <div className="grid grid-cols-1 gap-3 pb-20">
                        {allChains
                          .filter(chain => LIFI_SUPPORTED_CHAINS.includes(chain.chainId))
                          .map((chain) => (
                            <button 
                                key={chain.chainId}
                                onClick={() => {
                                    setSelectedNetworkForSelection(chain);
                                    setIsTokenSideSheetOpen(true);
                                }}
                                style={{
                                    borderColor: chain.themeColor || '#818cf8',
                                    borderWidth: '2px',
                                    background: `linear-gradient(135deg, ${chain.themeColor || '#818cf8'}25 0%, rgba(0,0,0,0) 100%)`,
                                }}
                                className="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={44} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                    <div className="text-left">
                                        <p className="font-black text-base text-white">{chain.name}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-mono opacity-60">Chain ID: {chain.chainId}</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-[#0a0a0c]/95 backdrop-blur-2xl border-l border-primary/20 w-full sm:max-w-[450px] p-0 flex flex-col h-full shadow-2xl">
            <SheetHeader className="p-6 border-b border-white/5 bg-gradient-to-b from-primary/10 to-transparent shrink-0">
                <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)} className="mb-4"><ArrowLeft className="w-5 h-5"/></Button>
                <SheetTitle className="text-lg font-black uppercase tracking-tight">{selectedNetworkForSelection?.name}</SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3 pb-20">
                    {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                        const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                        return (
                            <button 
                                key={asset.symbol}
                                onClick={() => handleTokenSelect(asset)}
                                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.symbol} size={44} chainId={asset.chainId} symbol={asset.symbol} name={asset.name} />
                                    <div className="text-left leading-tight">
                                        <p className="font-black text-base text-white">{asset.symbol}</p>
                                        <p className="text-xs text-muted-foreground">{asset.name}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm font-black text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
