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
  Fuel,
  Timer,
  Info,
  CheckCircle2,
  AlertCircle
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

export default function SwapPage() {
  const { allChains, viewingNetwork, balances, wallets, infuraApiKey, allAssets, allChainsMap } = useWallet();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // UI State
  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  const [slippage, setSlippage] = useState('0.5');
  const [customSlippage, setCustomSlippage] = useState('');
  
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);
  const [isSlippageSheetOpen, setIsSlippageSheetOpen] = useState(false);

  // Data State
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
      const userAddr = wallets ? getAddressForChain(viewingNetwork, wallets) : null;
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey || !userAddr) {
        setQuoteData(null);
        return;
      }
      setIsQuoteLoading(true);
      setFetchError(null);
      try {
        const fromAddr = fromToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : fromToken.address;
        const toAddr = toToken.isNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : toToken.address;
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

  const handleReverse = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setAmount('');
    setQuoteData(null);
  };

  const handleTokenSelect = (token: AssetRow) => {
    if (selectionType === 'from') setFromToken(token);
    else setToToken(token);
    setIsTokenSideSheetOpen(false);
    setIsNetworkSheetOpen(false);
  };

  const fromUsd = (parseFloat(amount) || 0) * (fromToken?.priceUsd || 0);
  const estimatedReceivedAmount = quoteData ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)) : 0;
  const toUsd = estimatedReceivedAmount * (toToken?.priceUsd || 0);

  const buttonState = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return { text: 'Enter Amount', disabled: true };
    if (parseFloat(amount) > parseFloat(fromToken?.balance || '0')) return { text: 'Insufficient Balance', disabled: true, variant: 'destructive' as const };
    if (isQuoteLoading) return { text: 'Finding Best Route...', disabled: true };
    if (fetchError) return { text: 'No Routes Found', disabled: true };
    if (!quoteData) return { text: 'Review Swap Details', disabled: true };
    return { text: 'Review Swap Details', disabled: false };
  }, [amount, fromToken, isQuoteLoading, fetchError, quoteData]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex flex-col items-center">
            <h1 className="text-lg font-black uppercase tracking-widest leading-none">Bridge & Swap</h1>
            <span className="text-[10px] text-primary font-black uppercase tracking-tighter mt-1">Best Price via LI.FI</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsSlippageSheetOpen(true)}><Settings2 className="w-5 h-5 text-muted-foreground" /></Button>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-2 overflow-y-auto pb-32 pt-6">
        {/* FROM SECTION */}
        <div className="p-6 rounded-[2.5rem] bg-[#121214] border border-white/5 space-y-4 relative shadow-2xl">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You Pay</span>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Balance: {parseFloat(fromToken?.balance || '0').toFixed(4)}</span>
                <button 
                    onClick={() => setAmount(fromToken?.balance || '0')}
                    className="text-[10px] font-black text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                >
                    MAX
                </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 flex flex-col">
                <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="text-5xl font-black bg-transparent border-none p-0 h-auto focus-visible:ring-0 placeholder:text-zinc-800" 
                />
                <p className="text-xs font-bold text-muted-foreground mt-1">≈ ${fromUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <Button 
                variant="outline" 
                className="h-14 gap-2 rounded-2xl bg-zinc-900 border-white/5 hover:bg-zinc-800 px-4 shadow-xl" 
                onClick={() => { setSelectionType('from'); setIsNetworkSheetOpen(true); }}
            >
              <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={32} chainId={fromToken?.chainId} name={fromToken?.name} symbol={fromToken?.symbol} />
              <span className="font-black text-base">{fromToken?.symbol}</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </Button>
          </div>
        </div>

        {/* REVERSE BUTTON */}
        <div className="relative h-2 z-10 flex justify-center">
            <button 
                onClick={handleReverse}
                className="absolute -top-6 w-12 h-12 rounded-2xl bg-zinc-900 border-4 border-background flex items-center justify-center text-primary shadow-2xl hover:scale-110 transition-transform active:rotate-180 duration-500"
            >
                <ArrowUpDown className="w-5 h-5" />
            </button>
        </div>

        {/* TO SECTION */}
        <div className="p-6 rounded-[2.5rem] bg-[#121214] border border-white/5 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You Receive Est.</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 flex flex-col">
                <div className="text-5xl font-black truncate">
                    {isQuoteLoading ? <Loader2 className="animate-spin text-primary" /> : (quoteData ? estimatedReceivedAmount.toFixed(6) : '0.00')}
                </div>
                <p className="text-xs font-bold text-muted-foreground mt-1">≈ ${toUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <Button 
                variant="outline" 
                className="h-14 gap-2 rounded-2xl bg-zinc-900 border-white/5 hover:bg-zinc-800 px-4 shadow-xl" 
                onClick={() => { setSelectionType('to'); setIsNetworkSheetOpen(true); }}
            >
              <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={32} chainId={toToken?.chainId} name={toToken?.name} symbol={toToken?.symbol} />
              <span className="font-black text-base">{toToken?.symbol}</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </Button>
          </div>
        </div>

        {/* QUOTE VISUALS */}
        {quoteData && (
            <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-6 mt-4 shadow-inner">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <RouteIcon className="w-4 h-4"/>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Execution Route</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <TokenLogoDynamic logoUrl={allChainsMap[fromToken?.chainId!]?.iconUrl} alt="from" size={14} chainId={fromToken?.chainId} name={allChainsMap[fromToken?.chainId!]?.name} symbol={fromToken?.symbol} />
                                <div className="w-4 h-[1.5px] bg-primary/30 rounded-full" />
                                <div className="text-[10px] font-bold text-primary uppercase">{quoteData.tool}</div>
                                <div className="w-4 h-[1.5px] bg-primary/30 rounded-full" />
                                <TokenLogoDynamic logoUrl={allChainsMap[toToken?.chainId!]?.iconUrl} alt="to" size={14} chainId={toToken?.chainId} name={allChainsMap[toToken?.chainId!]?.name} symbol={toToken?.symbol} />
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Est. Time</span>
                        <div className="flex items-center justify-end gap-1.5 text-primary font-bold text-xs mt-0.5">
                            <Timer className="w-3 h-3" />
                            {quoteData.estimate.executionDuration || 300}s
                        </div>
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Fuel className="w-3 h-3" /> Network Fee
                        </span>
                        <p className="font-bold text-xs text-white">~${quoteData.estimate.gasCosts?.[0]?.amountUsd || '2.50'}</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Slippage</span>
                        <p className="font-bold text-xs text-white">{slippage}%</p>
                    </div>
                </div>
            </div>
        )}

        <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto">
            <Button 
                variant={buttonState.variant || 'default'}
                className={cn(
                    "w-full h-16 rounded-[1.5rem] font-black text-lg shadow-2xl transition-all active:scale-95",
                    !buttonState.disabled && "shadow-primary/20"
                )}
                disabled={buttonState.disabled}
            >
                {buttonState.text}
            </Button>
        </div>
      </main>

      {/* NETWORK SELECTOR */}
      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-3xl -z-10" />
            <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />

            <div className="flex flex-col h-full relative z-10">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                <SheetHeader className="mb-6 px-6 shrink-0 pt-4">
                    <SheetTitle className="text-2xl font-black text-center uppercase tracking-widest">Select Network</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6 pb-12">
                    <div className="grid grid-cols-1 gap-3 pb-24">
                        {allChains.map((chain) => (
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
                                className="flex items-center justify-between p-4 rounded-3xl border transition-all hover:bg-white/5 active:scale-[0.98]"
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

      {/* TOKEN SELECTOR */}
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
                                className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-[0.98]"
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

      {/* SLIPPAGE SETTINGS */}
      <Sheet open={isSlippageSheetOpen} onOpenChange={setIsSlippageSheetOpen}>
        <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[2.5rem] p-8 h-auto overflow-hidden shadow-2xl">
            <div className="space-y-6">
                <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-widest">Slippage Tolerance</h3>
                    <p className="text-sm text-muted-foreground">Setting a high slippage might result in a bad trade. Setting too low might cause failure.</p>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    {['0.5', '1.0', '3.0'].map((val) => (
                        <Button 
                            key={val}
                            variant={slippage === val ? 'default' : 'outline'}
                            className="h-12 rounded-2xl font-black"
                            onClick={() => { setSlippage(val); setCustomSlippage(''); }}
                        >
                            {val}%
                        </Button>
                    ))}
                    <div className="relative">
                        <Input 
                            placeholder="Custom"
                            value={customSlippage}
                            onChange={(e) => {
                                setCustomSlippage(e.target.value);
                                setSlippage(e.target.value || '0.5');
                            }}
                            className="h-12 rounded-2xl bg-white/5 border-white/10 text-center font-black"
                        />
                    </div>
                </div>

                <Button 
                    className="w-full h-14 rounded-2xl font-black text-lg"
                    onClick={() => setIsSlippageSheetOpen(false)}
                >
                    Save Settings
                </Button>
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}