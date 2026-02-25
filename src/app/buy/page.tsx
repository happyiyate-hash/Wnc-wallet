'use client';

import { useState, useMemo } from 'react';
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
  Info
} from "lucide-react";
import { useWallet } from '@/contexts/wallet-provider';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const FEATURED_BUY_ASSETS = [
    { symbol: 'ETH', name: 'Ethereum', chainId: 1, coingeckoId: 'ethereum' },
    { symbol: 'USDT', name: 'Tether', chainId: 1, coingeckoId: 'tether' },
    { symbol: 'USDC', name: 'USD Coin', chainId: 1, coingeckoId: 'usd-coin' },
    { symbol: 'BTC', name: 'Bitcoin (Wrapped)', chainId: 1, coingeckoId: 'bitcoin' },
    { symbol: 'SOL', name: 'Solana', chainId: 1, coingeckoId: 'solana' },
    { symbol: 'POL', name: 'Polygon', chainId: 137, coingeckoId: 'polygon-ecosystem-token' },
];

export default function BuyPage() {
    const router = useRouter();
    const { prices } = useWallet();
    const [amount, setAmount] = useState('100');
    const [selectedAsset, setSelectedAsset] = useState(FEATURED_BUY_ASSETS[0]);
    const [isAssetSheetOpen, setIsAssetSheetOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');

    const currentPrice = prices[selectedAsset.coingeckoId]?.price || 0;
    const cryptoAmount = (parseFloat(amount) || 0) / (currentPrice || 1);

    const handleBuy = () => {
        alert("Institutional payment gateway requested. Contact your provider.");
    };

    return (
        <div className="flex flex-col h-screen bg-[#050505] text-foreground">
            <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex flex-col items-center text-center">
                    <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none">Buy Crypto</h1>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                        <span className="text-[8px] text-primary font-black uppercase tracking-tighter">Secure Fiat-to-Vault On-Ramp</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon"><Info className="w-5 h-5 text-muted-foreground" /></Button>
            </header>

            <main className="flex-1 p-6 space-y-8 max-w-lg mx-auto w-full overflow-y-auto thin-scrollbar pb-32">
                {/* AMOUNT INPUT */}
                <section className="space-y-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Purchase Amount</p>
                    <div className="p-8 rounded-[2.5rem] bg-secondary/20 border border-white/5 space-y-4 text-center">
                        <div className="flex items-baseline justify-center gap-2">
                            <span className="text-2xl font-bold text-muted-foreground/50">$</span>
                            <Input 
                                type="number" 
                                value={amount} 
                                onChange={(e) => setAmount(e.target.value)}
                                className="text-5xl font-black bg-transparent border-none p-0 h-auto text-center focus-visible:ring-0 tracking-tighter w-full max-w-[200px]"
                            />
                            <span className="text-sm font-black text-muted-foreground uppercase tracking-widest">USD</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 w-fit mx-auto">
                            <Zap className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-bold text-primary">You will receive ≈ {cryptoAmount.toFixed(6)} {selectedAsset.symbol}</span>
                        </div>
                    </div>
                </section>

                {/* ASSET SELECTOR */}
                <section className="space-y-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Receive Asset</p>
                    <button 
                        onClick={() => setIsAssetSheetOpen(true)}
                        className="w-full flex items-center justify-between p-5 rounded-[2rem] bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <TokenLogoDynamic 
                                logoUrl={null} 
                                alt={selectedAsset.symbol} 
                                size={40} 
                                chainId={selectedAsset.chainId} 
                                symbol={selectedAsset.symbol} 
                                name={selectedAsset.name} 
                            />
                            <div className="text-left">
                                <p className="font-bold text-base text-white">{selectedAsset.symbol}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{selectedAsset.name}</p>
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
                                "p-5 rounded-[2rem] border flex flex-col items-center gap-3 transition-all",
                                paymentMethod === 'card' ? "bg-primary/10 border-primary/50 text-primary" : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10"
                            )}
                        >
                            <CreditCard className="w-6 h-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Card</span>
                        </button>
                        <button 
                            onClick={() => setPaymentMethod('bank')}
                            className={cn(
                                "p-5 rounded-[2rem] border flex flex-col items-center gap-3 transition-all",
                                paymentMethod === 'bank' ? "bg-primary/10 border-primary/50 text-primary" : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10"
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
                    Buy {selectedAsset.symbol} Now
                </Button>
            </div>

            <Sheet open={isAssetSheetOpen} onOpenChange={setIsAssetSheetOpen}>
                <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[3rem] p-0 h-[70vh] overflow-hidden">
                    <div className="flex flex-col h-full">
                        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                        <SheetHeader className="px-6 mb-6">
                            <SheetTitle className="text-xl font-black text-center uppercase tracking-widest">Select Asset to Buy</SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="flex-1 px-6">
                            <div className="space-y-2 pb-12">
                                {FEATURED_BUY_ASSETS.map((asset) => (
                                    <button 
                                        key={asset.symbol}
                                        onClick={() => { setSelectedAsset(asset); setIsAssetSheetOpen(false); }}
                                        className="w-full flex items-center justify-between p-4 rounded-[1.5rem] bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-95"
                                    >
                                        <div className="flex items-center gap-4">
                                            <TokenLogoDynamic 
                                                logoUrl={null} 
                                                alt={asset.symbol} 
                                                size={32} 
                                                chainId={asset.chainId} 
                                                symbol={asset.symbol} 
                                                name={asset.name} 
                                            />
                                            <div className="text-left">
                                                <p className="font-bold text-sm">{asset.symbol}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-black">{asset.name}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
