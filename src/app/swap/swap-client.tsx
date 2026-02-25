
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Loader2, 
  ChevronRight,
  Settings2,
  Fuel,
  Timer,
  Plane,
  ChevronDown,
  ShieldCheck,
  ShieldAlert
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
import { Skeleton } from '@/components/ui/skeleton';

export default function SwapClientPage() {
  const { allChains, viewingNetwork, balances, wallets, infuraApiKey, allAssets, allChainsMap } = useWallet();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fromToken, setFromToken] = useState<AssetRow | null>(null);
  const [toToken, setToToken] = useState<AssetRow | null>(null);
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebounce(amount, 600);
  const [slippage, setSlippage] = useState('0.5');
  
  const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'from' | 'to'>('from');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);
  const [isSlippageSheetOpen, setIsSlippageSheetOpen] = useState(false);

  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
      const userAddr = wallets ? getAddressForChain(viewingNetwork, wallets) : '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
      
      if (!fromToken || !toToken || !debouncedAmount || parseFloat(debouncedAmount) <= 0 || !infuraApiKey) {
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
          fromAddress: userAddr || '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
          slippage: (parseFloat(slippage) / 100).toString()
        });
        const res = await fetch(`/api/bridge/quote?${params.toString()}`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.details || data.error);
        if (!data.estimate?.toAmount) throw new Error("No route found");
        
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
  const estimatedReceivedAmount = quoteData?.estimate?.toAmount 
    ? parseFloat(ethers.formatUnits(quoteData.estimate.toAmount, 18)) 
    : 0;
  const toUsd = estimatedReceivedAmount * (toToken?.priceUsd || 0);

  const fromChainColor = fromToken ? (allChainsMap[fromToken.chainId]?.themeColor || '#818cf8') : '#818cf8';
  const toChainColor = toToken ? (allChainsMap[toToken.chainId]?.themeColor || '#818cf8') : '#818cf8';

  const buttonState = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return { text: 'Enter Amount', disabled: true };
    if (parseFloat(amount) > parseFloat(fromToken?.balance || '0')) return { text: 'Insufficient Balance', disabled: true, variant: 'destructive' as const };
    if (isQuoteLoading) return { text: 'Fetching Route...', disabled: true };
    if (fetchError) return { text: 'No Routes Found', disabled: true };
    if (!quoteData) return { text: 'Loading...', disabled: true };
    return { text: `Swap via ${quoteData.tool?.toUpperCase() || 'Institutional'}`, disabled: false };
  }, [amount, fromToken, isQuoteLoading, fetchError, quoteData]);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-foreground">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex flex-col items-center text-center">
            <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none">Institutional Exchange</h1>
            <div className="flex items-center gap-1.5 mt-1.5">
                <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                <span className="text-[8px] text-primary font-black uppercase tracking-tighter">Aggregator Active</span>
            </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsSlippageSheetOpen(true)}><Settings2 className="w-5 h-5 text-muted-foreground" /></Button>
      </header>

      <main className="flex-1 w-full space-y-1 overflow-y-auto pb-40 pt-6 px-4">
        <section 
            style={{ 
                backgroundColor: `${fromChainColor}15`, 
                borderColor: `${fromChainColor}30`,
                boxShadow: `0 10px 40px -15px ${fromChainColor}25`
            }}
            className="w-full backdrop-blur-xl border p-4 rounded-[2rem] space-y-2 transition-all duration-500"
        >
          <div className="flex items-center justify-between">
            <button 
                onClick={() => { setSelectionType('from'); setIsNetworkSheetOpen(true); }}
                className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-2 py-1 rounded-full border border-white/10 transition-all active:scale-95"
            >
                <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={20} chainId={fromToken?.chainId} name={fromToken?.name} symbol={fromToken?.symbol} />
                <span className="font-black text-[10px] text-white uppercase">{fromToken?.symbol}</span>
                <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
            <div className="text-right">
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest block opacity-40">Available</span>
                <span className="text-[10px] font-mono font-bold text-white/80">{parseFloat(fromToken?.balance || '0').toFixed(4)}</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <Input 
                type="number" 
                placeholder="0.00" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="text-[clamp(1.5rem,6vw,2.2rem)] font-black bg-transparent border-none p-0 h-auto focus-visible:ring-0 placeholder:text-zinc-800 tracking-tighter" 
            />
            <p className="text-[10px] font-bold text-muted-foreground/60">≈ ${fromUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        </section>

        <div className="relative h-6 flex items-center justify-center z-10">
            <div 
                onClick={handleReverse}
                className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-primary shadow-2xl hover:scale-110 active:rotate-180 transition-all duration-500 group cursor-pointer"
            >
                <Plane className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </div>
        </div>

        <section 
            style={{ 
                backgroundColor: `${toChainColor}15`, 
                borderColor: `${toChainColor}30`,
                boxShadow: `0 10px 40px -15px ${toChainColor}25`
            }}
            className="w-full backdrop-blur-xl border p-4 rounded-[2rem] space-y-2 transition-all duration-500"
        >
          <div className="flex items-center justify-between">
            <button 
                onClick={() => { setSelectionType('to'); setIsNetworkSheetOpen(true); }}
                className="flex items-center gap-2 bg-black/60 hover:bg-black/80 px-2 py-1 rounded-full border border-white/10 transition-all active:scale-95"
            >
                <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={20} chainId={toToken?.chainId} name={toToken?.name} symbol={toToken?.symbol} />
                <span className="font-black text-[10px] text-white uppercase">{toToken?.symbol}</span>
                <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
            <div className="text-right">
                <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest block opacity-40">Estimate</span>
            </div>
          </div>

          <div className="space-y-0.5 min-h-[3.5rem] flex flex-col justify-center">
            {isQuoteLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-8 w-3/4 bg-white/5 rounded-xl" />
                    <Skeleton className="h-3 w-1/4 bg-white/5 rounded-lg" />
                </div>
            ) : (
                <>
                    <div className="text-[clamp(1.5rem,6vw,2.2rem)] font-black truncate tracking-tighter">
                        {estimatedReceivedAmount > 0 ? estimatedReceivedAmount.toFixed(6) : '0.00'}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground/60">≈ ${toUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </>
            )}
          </div>
        </section>

        {quoteData && (
            <div className="mx-2 mt-4 p-4 rounded-2xl bg-zinc-900/90 border border-white/5 space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between px-2 text-[9px] font-black uppercase tracking-widest">
                    <div className="flex items-center gap-2 text-primary">
                        <Timer className="w-3 h-3" />
                        <span>{Math.ceil((quoteData?.estimate?.executionDuration || 300) / 60)} MIN</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-muted-foreground/50 text-[7px] mb-0.5">EST. FEE</span>
                            <span className="text-white font-mono">$ {parseFloat(quoteData?.estimate?.gasCosts?.[0]?.amountUsd || '0').toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-muted-foreground/50 text-[7px] mb-0.5">SLIPPAGE</span>
                            <span className="text-white font-mono">{slippage}%</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {fetchError && !isQuoteLoading && (
          <div className="mx-2 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-bold flex items-center gap-3">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            Route not available for this pair.
          </div>
        )}

        <div className="fixed bottom-8 left-0 right-0 px-6 z-40">
            <Button 
                variant={buttonState.variant || 'default'}
                className={cn(
                    "w-full h-16 rounded-full font-black text-lg shadow-2xl transition-all active:scale-95 border-b-4 border-primary/50",
                    buttonState.disabled && "opacity-50 border-b-0 shadow-none grayscale"
                )}
                disabled={buttonState.disabled}
            >
                {buttonState.text}
            </Button>
        </div>
      </main>

      <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden">
            <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-3xl -z-10" />
            <div className="flex flex-col h-full relative z-10">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                <SheetHeader className="mb-6 px-6 shrink-0 pt-4">
                    <SheetTitle className="sr-only">Select Network</SheetTitle>
                    <div className="text-2xl font-black text-center uppercase tracking-widest text-white">Select Network</div>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6 pb-12">
                    <div className="grid grid-cols-1 gap-2 pb-24">
                        {allChains.map((chain) => (
                            <button 
                                key={chain.chainId}
                                onClick={() => {
                                    setSelectedNetworkForSelection(chain);
                                    setIsTokenSideSheetOpen(true);
                                }}
                                style={{
                                    borderColor: `${chain.themeColor || '#818cf8'}40`,
                                    background: `linear-gradient(135deg, ${chain.themeColor || '#818cf8'}15 0%, rgba(0,0,0,0) 100%)`,
                                }}
                                className="flex items-center justify-between p-4 rounded-3xl border transition-all hover:bg-white/5 active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={40} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                    <div className="text-left">
                                        <p className="font-black text-base text-white">{chain.name}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-mono opacity-60">ID: {chain.chainId}</p>
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
        <SheetContent side="right" className="bg-[#050505]/95 backdrop-blur-2xl border-l border-white/5 w-full sm:max-w-[450px] p-0 flex flex-col h-full">
            <SheetHeader className="p-6 border-b border-white/5 bg-gradient-to-b from-primary/10 to-transparent shrink-0">
                <SheetTitle className="sr-only">Select Token</SheetTitle>
                <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)} className="mb-4"><ArrowLeft className="w-5 h-5"/></Button>
                <div className="text-lg font-black uppercase tracking-tight text-white">{selectedNetworkForSelection?.name}</div>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-2 pb-20">
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
                                        <p className="font-bold text-base text-white">{asset.symbol}</p>
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

      <Sheet open={isSlippageSheetOpen} onOpenChange={setIsSlippageSheetOpen}>
        <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[2.5rem] p-8 h-auto overflow-hidden">
            <div className="space-y-6">
                <SheetHeader>
                    <SheetTitle className="sr-only">Trading Rules</SheetTitle>
                    <div className="text-xl font-black uppercase tracking-widest text-white">Trading Rules</div>
                </SheetHeader>
                <div className="grid grid-cols-4 gap-2">
                    {['0.5', '1.0', '3.0'].map((val) => (
                        <Button 
                            key={val}
                            variant={slippage === val ? 'default' : 'outline'}
                            className="h-12 rounded-2xl font-black"
                            onClick={() => setSlippage(val)}
                        >
                            {val}%
                        </Button>
                    ))}
                </div>
                <Button className="w-full h-14 rounded-2xl font-black text-lg" onClick={() => setIsSlippageSheetOpen(false)}>Apply Settings</Button>
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
