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
  Timer,
  Info,
  Fuel,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { useUser } from '@/contexts/user-provider';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { getInitialAssets } from '@/lib/wallets/balances';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { getAddressForChain } from '@/lib/wallets/utils';
import { ethers } from 'ethers';
import { useDebounce } from '@/hooks/use-debounce';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LIFI_SUPPORTED_CHAINS } from '@/lib/lifiSupportedChains';

export default function SwapPage() {
  const { allChains, viewingNetwork, balances, wallets, infuraApiKey, allAssets } = useWallet();
  const { user } = useUser();
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
  const [isSlippageOpen, setIsSlippageOpen] = useState(false);

  // Data State
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Derived Values
  const fromBalance = parseFloat(fromToken?.balance || '0');
  const fromPrice = fromToken?.priceUsd || 0;
  const toPrice = toToken?.priceUsd || 0;
  const payUsd = (parseFloat(amount) || 0) * fromPrice;
  const receiveUsd = quoteData ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)) * toPrice : 0;
  
  const isInsufficientBalance = parseFloat(amount) > fromBalance;
  const canSwap = parseFloat(amount) > 0 && !isInsufficientBalance && !!quoteData && !isQuoteLoading;

  // Initialization
  useEffect(() => {
    if (!fromToken && allAssets.length > 0) {
      const fromSymbol = searchParams.get('symbol') || searchParams.get('fromSymbol');
      const chainIdParam = parseInt(searchParams.get('chainId') || '');
      const targetChainId = !isNaN(chainIdParam) ? chainIdParam : viewingNetwork.chainId;
      const found = allAssets.find(a => a.symbol === fromSymbol && a.chainId === targetChainId) || allAssets[0];
      if (found) setFromToken({ ...found });
    }
    if (!toToken && allAssets.length > 0) {
      const found = allAssets.find(a => a.symbol !== fromToken?.symbol) || allAssets[allAssets.length - 1];
      if (found) setToToken({ ...found });
    }
  }, [allAssets, searchParams, fromToken, toToken, viewingNetwork.chainId]);

  useEffect(() => {
    const getQuote = async () => {
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey) {
        setQuoteData(null);
        return;
      }

      if (!LIFI_SUPPORTED_CHAINS.includes(fromToken.chainId) || !LIFI_SUPPORTED_CHAINS.includes(toToken.chainId)) {
        setFetchError("Chain not supported for cross-chain swaps");
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
    getQuote();
  }, [debouncedAmount, fromToken, toToken, wallets, viewingNetwork, slippage, infuraApiKey]);

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
  };

  const reverseTokens = () => {
    const prevFrom = fromToken;
    setFromToken(toToken);
    setToToken(prevFrom);
    setAmount('');
    setQuoteData(null);
  };

  const getButtonText = () => {
    if (!amount || parseFloat(amount) <= 0) return 'Enter Amount';
    if (isInsufficientBalance) return 'Insufficient Balance';
    if (isQuoteLoading) return 'Finding Best Price...';
    if (fetchError) return 'Routing Error';
    if (quoteData) return 'Review Swap Details';
    return 'Swap';
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex flex-col items-center">
            <h1 className="text-sm font-black uppercase tracking-[0.2em]">Bridge & Swap</h1>
            <span className="text-[10px] text-primary font-bold">Best Price via LI.FI</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsSlippageOpen(true)}><Settings2 className="w-5 h-5 text-muted-foreground" /></Button>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-2 overflow-y-auto pb-32">
        {/* FROM SECTION */}
        <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5 space-y-4 relative">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You Pay</span>
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/60 font-bold uppercase">Balance: {fromBalance.toFixed(4)}</span>
                <button 
                    onClick={() => setAmount(fromBalance.toString())}
                    className="text-[10px] font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
                >
                    MAX
                </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Input 
                type="number" 
                placeholder="0.00" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="text-4xl font-black bg-transparent border-none p-0 h-auto flex-1 focus-visible:ring-0 placeholder:text-white/10" 
            />
            <Button 
                variant="outline" 
                className="h-14 gap-3 bg-white/5 border-white/5 rounded-2xl px-4 hover:bg-white/10 transition-all shadow-xl" 
                onClick={() => { setSelectionType('from'); setIsNetworkSheetOpen(true); }}
            >
              <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={28} chainId={fromToken?.chainId} name={fromToken?.name} symbol={fromToken?.symbol} />
              <span className="font-black text-sm">{fromToken?.symbol}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="text-[11px] font-bold text-muted-foreground/40">
            ≈ ${payUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* REVERSE BUTTON */}
        <div className="flex justify-center -my-6 relative z-10">
            <Button 
                variant="secondary" 
                size="icon" 
                onClick={reverseTokens}
                className="w-12 h-12 rounded-2xl bg-[#1a1a1e] border-4 border-background shadow-2xl hover:scale-110 active:rotate-180 transition-all text-primary"
            >
                <ArrowUpDown className="w-5 h-5" />
            </Button>
        </div>

        {/* TO SECTION */}
        <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You Receive Est.</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-4xl font-black">
                {isQuoteLoading ? (
                    <div className="flex items-center gap-2"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : (
                    <span className={cn(quoteData ? "text-white" : "text-white/10")}>
                        {quoteData ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)).toFixed(6) : '0.00'}
                    </span>
                )}
            </div>
            <Button 
                variant="outline" 
                className="h-14 gap-3 bg-white/5 border-white/5 rounded-2xl px-4 hover:bg-white/10 transition-all shadow-xl" 
                onClick={() => { setSelectionType('to'); setIsNetworkSheetOpen(true); }}
            >
              <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={28} chainId={toToken?.chainId} name={toToken?.name} symbol={toToken?.symbol} />
              <span className="font-black text-sm">{toToken?.symbol}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="text-[11px] font-bold text-muted-foreground/40">
            ≈ ${receiveUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* QUOTE VISUALS */}
        {(quoteData || isQuoteLoading || fetchError) && (
            <div className="pt-4 space-y-3">
                {fetchError && (
                    <div className="p-4 rounded-[1.5rem] bg-destructive/10 border border-destructive/20 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-destructive" />
                        <p className="text-xs font-bold text-destructive">{fetchError}</p>
                    </div>
                )}

                {quoteData && (
                    <div className="p-5 rounded-[2rem] bg-white/5 border border-white/5 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                <RouteIcon className="w-3.5 h-3.5 text-primary"/> Execution Route
                            </div>
                            <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{quoteData.tool}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-white/5 p-2 pr-4 rounded-full border border-white/5">
                                <TokenLogoDynamic 
                                    size={20} 
                                    logoUrl={allChains.find(c => c.chainId === fromToken?.chainId)?.iconUrl} 
                                    chainId={fromToken?.chainId} 
                                    name={allChains.find(c => c.chainId === fromToken?.chainId)?.name}
                                    symbol={allChains.find(c => c.chainId === fromToken?.chainId)?.symbol}
                                    alt="From Network"
                                />
                                <span className="text-[10px] font-black uppercase">{allChains.find(c => c.chainId === fromToken?.chainId)?.name}</span>
                            </div>
                            <div className="h-0.5 flex-1 bg-gradient-to-r from-primary to-purple-500 rounded-full opacity-30" />
                            <div className="flex items-center gap-2 bg-white/5 p-2 pr-4 rounded-full border border-white/5">
                                <TokenLogoDynamic 
                                    size={20} 
                                    logoUrl={allChains.find(c => c.chainId === toToken?.chainId)?.iconUrl} 
                                    chainId={toToken?.chainId} 
                                    name={allChains.find(c => c.chainId === toToken?.chainId)?.name}
                                    symbol={allChains.find(c => c.chainId === toToken?.chainId)?.symbol}
                                    alt="To Network"
                                />
                                <span className="text-[10px] font-black uppercase">{allChains.find(c => c.chainId === toToken?.chainId)?.name}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div className="space-y-1">
                                <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-1.5">
                                    <Fuel className="w-3 h-3" /> Network Fee
                                </p>
                                <p className="text-xs font-bold font-mono">~${quoteData.estimate.gasCosts?.[0]?.amountUsd || '2.50'}</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest flex items-center justify-end gap-1.5">
                                    <Timer className="w-3 h-3" /> Time Est.
                                </p>
                                <p className="text-xs font-bold">~{Math.ceil((quoteData.estimate.executionDuration || 300) / 60)} min</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto">
            <Button 
                className={cn(
                    "w-full h-16 rounded-[1.5rem] font-black text-lg shadow-2xl transition-all active:scale-95",
                    isInsufficientBalance ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90 shadow-primary/30"
                )}
                disabled={!canSwap || isQuoteLoading}
            >
                {getButtonText()}
            </Button>
        </div>
      </main>

      {/* FIXED NETWORK SELECTOR */}
      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-3xl -z-10" />
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
                                className="flex items-center justify-between p-4 rounded-3xl border transition-all hover:bg-white/5 active:scale-95"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={40} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                    <div className="text-left leading-none">
                                        <p className="font-black text-base text-white">{chain.name}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-mono mt-1 opacity-60">Chain ID: {chain.chainId}</p>
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
                <SheetTitle className="text-xl font-black uppercase tracking-tight">{selectedNetworkForSelection?.name}</SheetTitle>
                <SheetDescription className="text-xs uppercase tracking-widest font-bold">Select an asset to trade</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3 pb-20">
                    {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                        const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                        return (
                            <button 
                                key={asset.symbol}
                                onClick={() => handleTokenSelect(asset)}
                                className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-[0.98] text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.symbol} size={44} chainId={asset.chainId} symbol={asset.symbol} name={asset.name} />
                                    <div className="text-left leading-tight">
                                        <p className="font-black text-base text-white">{asset.symbol}</p>
                                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter opacity-60">{asset.name}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm font-black text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-black opacity-40">Available</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* SLIPPAGE SETTINGS SHEET */}
      <Sheet open={isSlippageOpen} onOpenChange={setIsSlippageOpen}>
        <SheetContent side="bottom" className="rounded-t-[3rem] bg-[#0a0a0c] border-t border-primary/20 p-8 pt-4 pb-12 max-h-[400px]">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
            <SheetHeader className="text-center mb-8">
                <SheetTitle className="text-2xl font-black uppercase tracking-[0.2em]">Transaction Settings</SheetTitle>
                <SheetDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Adjust slippage tolerance for your swap</SheetDescription>
            </SheetHeader>
            
            <div className="space-y-6 max-w-sm mx-auto">
                <div className="flex items-center justify-between px-2">
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Slippage Tolerance</span>
                    <span className="text-sm font-black text-primary">{slippage}%</span>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                    {['0.5', '1.0', '3.0'].map((val) => (
                        <Button 
                            key={val}
                            variant={slippage === val ? 'default' : 'outline'}
                            onClick={() => setSlippage(val)}
                            className={cn(
                                "h-12 rounded-2xl font-black text-xs transition-all",
                                slippage === val ? "bg-primary shadow-lg shadow-primary/20" : "bg-white/5 border-white/5"
                            )}
                        >
                            {val}%
                        </Button>
                    ))}
                    <div className="relative">
                        <Input 
                            placeholder="Custom" 
                            type="number"
                            value={['0.5', '1.0', '3.0'].includes(slippage) ? '' : slippage}
                            onChange={(e) => setSlippage(e.target.value)}
                            className="h-12 bg-white/5 border-white/5 rounded-2xl text-center font-black text-xs focus-visible:ring-primary"
                        />
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex gap-3">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-muted-foreground leading-relaxed uppercase tracking-tight">
                        Setting high slippage can help transactions succeed in volatile markets, but may result in a less favorable rate.
                    </p>
                </div>

                <Button 
                    className="w-full h-14 rounded-2xl bg-primary font-black uppercase tracking-widest text-sm shadow-xl"
                    onClick={() => setIsSlippageOpen(false)}
                >
                    Save Settings
                </Button>
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
