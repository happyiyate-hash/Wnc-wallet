
'use client';

import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWallet } from '@/contexts/wallet-provider';
import { ArrowLeft, ChevronRight, Search, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import TokenLogoDynamic from './TokenLogoDynamic';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { cn } from '@/lib/utils';

interface GlobalTokenSelectorProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (token: AssetRow) => void;
    title?: string;
}

// Utility to determine text contrast for network buttons
const getContrastColor = (hex: string) => {
  if (!hex || hex.length < 7) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
};

export default function GlobalTokenSelector({
    isOpen,
    onOpenChange,
    onSelect,
    title = "Select Asset"
}: GlobalTokenSelectorProps) {
    const { allChains, balances, getAvailableAssetsForChain } = useWallet();
    const [selectedNetwork, setSelectedNetwork] = useState<ChainConfig | null>(null);
    const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredChains = useMemo(() => {
        return allChains.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allChains, searchTerm]);

    const handleNetworkClick = (chain: ChainConfig) => {
        setSelectedNetwork(chain);
        setIsTokenSideSheetOpen(true);
    };

    const handleTokenClick = (token: AssetRow) => {
        onSelect(token);
        setIsTokenSideSheetOpen(false);
        onOpenChange(false);
        setSearchTerm('');
    };

    return (
        <>
            {/* STAGE 1: NETWORK SELECTION (BOTTOM SHEET) */}
            <Sheet open={isOpen} onOpenChange={onOpenChange}>
                <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] flex flex-col overflow-hidden shadow-2xl z-[150]">
                    <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-3xl -z-10" />
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />
                    
                    <div className="flex flex-col flex-1 relative z-10 overflow-hidden">
                        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                        <SheetHeader className="mb-6 px-6 shrink-0 pt-4">
                            <SheetTitle className="text-2xl font-black text-center uppercase tracking-widest text-white">{title}</SheetTitle>
                            <div className="relative mt-4">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                                <Input 
                                    placeholder="Search networks..."
                                    className="bg-white/5 border-white/10 pl-11 h-12 rounded-2xl focus-visible:ring-primary text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </SheetHeader>
                        
                        <ScrollArea className="flex-1 px-6">
                            <div className="grid grid-cols-2 gap-3 pb-24 pt-2">
                                {filteredChains.map((chain) => {
                                    const themeColor = chain.themeColor || '#818cf8';
                                    const textColor = getContrastColor(themeColor);
                                    return (
                                        <button 
                                            key={chain.chainId}
                                            onClick={() => handleNetworkClick(chain)}
                                            style={{
                                                borderColor: themeColor,
                                                borderWidth: '2px',
                                                background: `linear-gradient(135deg, ${themeColor} 0%, rgba(0,0,0,0.8) 100%)`,
                                            }}
                                            className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group active:scale-95"
                                        >
                                            <TokenLogoDynamic 
                                                logoUrl={chain.iconUrl} 
                                                alt={chain.name} 
                                                size={40} 
                                                chainId={chain.chainId} 
                                                name={chain.name} 
                                                symbol={chain.symbol}
                                            />
                                            <p className="font-black text-[11px] uppercase tracking-tight line-clamp-1" style={{ color: textColor }}>{chain.name}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </SheetContent>
            </Sheet>

            {/* STAGE 2: TOKEN SELECTION (SIDE SHEET) */}
            <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
                <SheetContent side="right" className="bg-[#0a0a0c]/95 backdrop-blur-2xl border-l border-primary/20 w-full sm:max-w-[450px] p-0 flex flex-col shadow-2xl z-[160]">
                    <SheetHeader className="p-6 border-b border-white/5 bg-gradient-to-b from-primary/10 to-transparent shrink-0">
                        <div className="flex items-center gap-4 mb-4">
                            <Button variant="ghost" size="icon" onClick={() => setIsTokenSideSheetOpen(false)} className="rounded-xl">
                                <ArrowLeft className="w-5 h-5"/>
                            </Button>
                            <div className="flex flex-col items-start">
                                <span className="text-lg font-black uppercase tracking-tight text-white">{selectedNetwork?.name}</span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Select Token Asset</span>
                            </div>
                        </div>
                    </SheetHeader>
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-2 pb-20">
                            {selectedNetwork && getAvailableAssetsForChain(selectedNetwork.chainId).map((token) => {
                                const asset = (balances[selectedNetwork.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                                return (
                                    <button 
                                        key={asset.symbol}
                                        onClick={() => handleTokenClick(asset)}
                                        className="w-full flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <TokenLogoDynamic 
                                                logoUrl={asset.iconUrl} 
                                                alt={asset.symbol} 
                                                size={44} 
                                                chainId={asset.chainId} 
                                                symbol={asset.symbol} 
                                                name={asset.name}
                                            />
                                            <div>
                                                <p className="font-bold text-base text-white">{asset.symbol}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{asset.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-sm font-bold text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-1">Available</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </>
    );
}
