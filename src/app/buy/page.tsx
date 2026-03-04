
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  ChevronRight, 
  CreditCard, 
  Building2, 
  ShieldCheck, 
  Sparkles,
  Zap,
  Info,
  Loader2
} from "lucide-react";
import { useWallet } from '@/contexts/wallet-provider';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import type { AssetRow, ChainConfig } from '@/lib/types';

export default function BuyPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { allAssets, allChains, prices, viewingNetwork, getAvailableAssetsForChain, balances } = useWallet();
    
    const [amount, setAmount] = useState('100');
    const [selectedAsset, setSelectedAsset] = useState<AssetRow | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');
    
    const [isNetworkSheetOpen, setIsNetworkSheetOpen] = useState(false);
    const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
    const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

    // Sync initial asset
    useEffect(() => {
        if (!selectedAsset && allAssets.length > 0) {
            const initial = allAssets.find(a => a.chainId === viewingNetwork.chainId) || allAssets[0];
            setSelectedAsset(initial);
        }
    }, [allAssets, selectedAsset, viewingNetwork.chainId]);

    const currentPrice = useMemo(() => {
        if (!selectedAsset) return 0;
        const priceId = (selectedAsset.priceId || selectedAsset.coingeckoId || selectedAsset.address)?.toLowerCase();
        return prices[priceId]?.price || 0;
    }, [selectedAsset, prices]);

    const cryptoAmount = (parseFloat(amount) || 0) / (currentPrice || 1);

    const handleBuy = () => {
        toast({
            title: "Coming Soon",
            description: "Institutional fiat on-ramp is being finalized. This feature will be available shortly.",
        });
    };

    const handleTokenSelect = (token: AssetRow) => {
        setSelectedAsset(token);
        setIsTokenSideSheetOpen(false);
        setIsNetworkSheetOpen(false);
    };

    return (
        <div className="flex flex-col h-screen bg-transparent text-foreground">
            <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-2xl sticky top-0 z-50 px-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
                    <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </Button>
                <div className="flex flex-col items-center text-center">
                    <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none text-white">Buy Crypto</h1>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                        <span className="text-[8px] text-primary font-black uppercase tracking-tighter">Secure On-Ramp</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl"><Info className="w-5 h-5 text-muted-foreground" /></Button>
            </header>

            <main className="flex-1 p-6 space-y-8 max-w-lg mx-auto w-full overflow-y-auto thin-scrollbar pb-32">
                {/* AMOUNT INPUT */}
                <section className="space-y-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Purchase Amount</p>
                    <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 space-y-4 text-center shadow-2xl">
                        <div className="flex items-baseline justify-center gap-2">
                            <span className="text-2xl font-bold text-muted-foreground/50">$</span>
                            <Input 
                                type="number" 
                                value={amount} 
                                onChange={(e) => setAmount(e.target.value)}
                                className="text-5xl font-black bg-transparent border-none p-0 h-auto text-center focus-visible:ring-0 tracking-tighter w-full max-w-[200px] text-white"
                            />
                            <span className="text-sm font-black text-muted-foreground uppercase tracking-widest">USD</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 w-fit mx-auto">
                            <Zap className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-bold text-primary">You will receive ≈ {cryptoAmount.toFixed(6)} {selectedAsset?.symbol}</span>
                        </div>
                    </div>
                </section>

                {/* ASSET SELECTOR */}
                <section className="space-y-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Receive Asset</p>
                    <button 
                        onClick={() => setIsNetworkSheetOpen(true)}
                        className="w-full flex items-center justify-between p-5 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group shadow-2xl"
                    >
                        <div className="flex items-center gap-4">
                            <TokenLogoDynamic 
                                logoUrl={selectedAsset?.iconUrl} 
                                alt={selectedAsset?.symbol || ''} 
                                size={40} 
                                chainId={selectedAsset?.chainId} 
                                symbol={selectedAsset?.symbol} 
                                name={selectedAsset?.name} 
                            />
                            <div className="text-left">
                                <p className="font-bold text-base text-white">{selectedAsset?.symbol || 'Select Asset'}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{selectedAsset?.name}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </button>
                </section>

                {/* PAYMENT METHODS */}
                <section className="space-y-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Payment Method</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setPaymentMethod('card')}
                            className={cn(
                                "p-5 rounded-[2rem] border flex flex-col items-center gap-3 transition-all shadow-2xl",
                                paymentMethod === 'card' ? "bg-primary/10 border-primary/50 text-primary" : "bg-white/[0.03] border-white/5 text-muted-foreground hover:bg-white/[0.06]"
                            )}
                        >
                            <CreditCard className="w-6 h-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Card</span>
                        </button>
                        <button 
                            onClick={() => setPaymentMethod('bank')}
                            className={cn(
                                "p-5 rounded-[2rem] border flex flex-col items-center gap-3 transition-all shadow-2xl",
                                paymentMethod === 'bank' ? "bg-primary/10 border-primary/50 text-primary" : "bg-white/[0.03] border-white/5 text-muted-foreground hover:bg-white/[0.06]"
                            )}
                        >
                            <Building2 className="w-6 h-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Bank</span>
                        </button>
                    </div>
                </section>

                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Funds will be deposited directly into your secure <span className="text-primary font-bold">Vault Address</span> once the transaction is verified.
                    </p>
                </div>
            </main>

            <div className="fixed bottom-8 left-0 right-0 px-6 z-40">
                <Button 
                    className="w-full h-16 rounded-full font-black text-lg shadow-2xl transition-all active:scale-95 border-b-4 border-primary/50 shadow-primary/30"
                    onClick={handleBuy}
                >
                    Buy {selectedAsset?.symbol || 'Crypto'} Now
                </Button>
            </div>

            {/* NETWORK SELECTION SHEET */}
            <Sheet open={isNetworkSheetOpen} onOpenChange={setIsNetworkSheetOpen}>
                <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                    <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-3xl -z-10" />
                    <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                    <SheetHeader className="mb-6 px-6 pt-4 shrink-0">
                        <SheetTitle className="sr-only">Select Network</SheetTitle>
                        <div className="text-2xl font-black text-center uppercase tracking-widest text-white">Select Network</div>
                    </SheetHeader>
                    <ScrollArea className="flex-1 px-6">
                        <div className="grid grid-cols-2 gap-3 pb-32">
                            {allChains.map((chain) => (
                                <button 
                                    key={chain.chainId} 
                                    onClick={() => { setSelectedNetworkForSelection(chain); setIsTokenSideSheetOpen(true); }} 
                                    style={{ borderColor: `${chain.themeColor || '#818cf8'}40`, background: `linear-gradient(135deg, ${chain.themeColor || '#818cf8'}15 0%, rgba(0,0,0,0) 100%)` }} 
                                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group active:scale-95"
                                >
                                    <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={40} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                    <p className="font-black text-[11px] uppercase tracking-tight text-white group-hover:text-primary transition-colors">{chain.name}</p>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            {/* TOKEN SELECTION SHEET */}
            <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
                <SheetContent side="right" className="bg-[#0a0a0c]/95 backdrop-blur-2xl border-l border-white/5 w-full sm:max-w-[450px] p-0 flex flex-col h-full overflow-hidden shadow-2xl">
                    <SheetHeader className="p-6 border-b border-white/5 shrink-0">
                        <SheetTitle className="sr-only">Select Token</SheetTitle>
                        <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)} className="mb-4 rounded-xl"><ArrowLeft className="w-5 h-5"/></Button>
                        <div className="text-lg font-black uppercase tracking-tight text-white">{selectedNetworkForSelection?.name}</div>
                    </SheetHeader>
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-2 pb-32">
                            {selectedNetworkForSelection && getAvailableAssetsForChain(selectedNetworkForSelection.chainId).map((token) => { 
                                const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow; 
                                return (
                                    <button 
                                        key={asset.symbol} 
                                        onClick={() => handleTokenSelect(asset)} 
                                        className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/10 transition-all text-left group active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <TokenLogoDynamic logoUrl={asset.iconUrl} alt={asset.symbol} size={44} chainId={asset.chainId} symbol={asset.symbol} name={asset.name} />
                                            <div>
                                                <p className="font-black text-base text-white">{asset.symbol}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-40">{asset.name}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
