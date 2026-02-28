'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { useWallet } from '@/contexts/wallet-provider';
import { 
  Copy, 
  CheckCircle2, 
  Search, 
  ChevronDown, 
  X, 
  Globe, 
  Cpu,
  ArrowRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import TokenLogoDynamic from './TokenLogoDynamic';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

interface GlobalTokenSelectorProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (token: AssetRow) => void;
    title?: string;
}

export default function GlobalTokenSelector({
    isOpen,
    onOpenChange,
    onSelect,
    title = "Select Asset"
}: GlobalTokenSelectorProps) {
    const { 
        allChains, 
        viewingNetwork, 
        balances, 
        getAvailableAssetsForChain, 
        wallets, 
        getAddressForChain 
    } = useWallet();

    const [selectedChain, setSelectedNetwork] = useState<ChainConfig>(viewingNetwork);
    const [isNetworkListOpen, setIsNetworkListOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCopied, copy] = useCopyToClipboard();

    // Reset local selection to current viewing network when opened
    useEffect(() => {
        if (isOpen) {
            setSelectedNetwork(viewingNetwork);
            setIsNetworkListOpen(false);
            setSearchTerm('');
        }
    }, [isOpen, viewingNetwork]);

    const activeAddress = useMemo(() => {
        if (!wallets) return '';
        return getAddressForChain(selectedChain, wallets) || '';
    }, [selectedChain, wallets, getAddressForChain]);

    const maskedAddress = useMemo(() => {
        if (!activeAddress) return 'Initializing...';
        return `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`;
    }, [activeAddress]);

    const currentAssets = useMemo(() => {
        const base = getAvailableAssetsForChain(selectedChain.chainId);
        const chainBalances = balances[selectedChain.chainId] || [];
        
        return base.map(asset => {
            const balDoc = chainBalances.find(b => b.symbol === asset.symbol);
            return {
                ...asset,
                balance: balDoc?.balance || '0'
            };
        }).filter(a => 
            a.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
            a.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [selectedChain, balances, searchTerm, getAvailableAssetsForChain]);

    const filteredChains = useMemo(() => {
        return allChains.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allChains, searchTerm]);

    const handleTokenClick = (token: AssetRow) => {
        onSelect(token);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[92vw] max-w-[440px] h-[75vh] bg-gradient-to-br from-zinc-900/40 via-black/90 to-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-0 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] z-[150] gap-0 flex flex-col">
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <DialogDescription className="sr-only">Transparent asset control cockpit with integrated network switching.</DialogDescription>

                {/* HEADER COCKPIT */}
                <div className="p-6 border-b border-white/5 space-y-4 shrink-0 bg-white/[0.02]">
                    <div className="flex items-center justify-between gap-3">
                        {/* NETWORK SWITCHER DROPDOWN (LEFT) */}
                        <button 
                            onClick={() => setIsNetworkListOpen(!isNetworkListOpen)}
                            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all active:scale-95 shrink-0"
                        >
                            <TokenLogoDynamic 
                                logoUrl={selectedChain.iconUrl} 
                                alt={selectedChain.name} 
                                size={20} 
                                chainId={selectedChain.chainId} 
                                symbol={selectedChain.symbol}
                                name={selectedChain.name}
                            />
                            <span className="text-[10px] font-black uppercase text-white tracking-tighter">{selectedChain.name}</span>
                            <ChevronDown className={cn("w-3 h-3 text-primary transition-transform duration-300", isNetworkListOpen && "rotate-180")} />
                        </button>

                        {/* IDENTITY NODE (RIGHT - MASKED) */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/[0.05] border border-white/10 group min-w-0">
                            <p className="text-[10px] font-mono text-white/60 tracking-tight">
                                {maskedAddress}
                            </p>
                            <button 
                                onClick={() => copy(activeAddress)}
                                className="text-primary hover:text-primary/80 transition-colors shrink-0"
                            >
                                {isCopied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <Input 
                            placeholder={isNetworkListOpen ? "Search networks..." : "Search assets..."}
                            className="bg-black/40 border-white/10 pl-11 h-14 rounded-2xl focus-visible:ring-primary text-base placeholder:text-white/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 relative overflow-hidden">
                    {/* INTERNAL NETWORK LIST (ANIMATED OVERLAY) */}
                    <AnimatePresence>
                        {isNetworkListOpen && (
                            <motion.div 
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                                className="absolute inset-0 z-20 bg-black/95 backdrop-blur-xl p-4 overflow-hidden flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-6 px-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Target Ecosystem</span>
                                    <button onClick={() => setIsNetworkListOpen(false)} className="text-white/20 hover:text-white transition-colors p-2"><X className="w-5 h-5" /></button>
                                </div>
                                <ScrollArea className="flex-1">
                                    <div className="grid grid-cols-2 gap-3 pb-10">
                                        {filteredChains.map((chain) => (
                                            <button 
                                                key={chain.chainId}
                                                onClick={() => { setSelectedNetwork(chain); setIsNetworkListOpen(false); }}
                                                className={cn(
                                                    "flex flex-col items-center gap-3 p-5 rounded-[2rem] border transition-all active:scale-95 group",
                                                    selectedChain.chainId === chain.chainId 
                                                        ? "bg-primary/10 border-primary/40 shadow-[0_0_30px_rgba(139,92,246,0.15)]" 
                                                        : "bg-white/[0.03] border-white/5 hover:bg-white/[0.08]"
                                                )}
                                            >
                                                <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={40} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                                <p className="font-black text-[10px] uppercase tracking-tight text-white group-hover:text-primary transition-colors line-clamp-1">{chain.name}</p>
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* MAIN TOKEN LIST */}
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-2 pb-24">
                            <AnimatePresence mode="popLayout">
                                {currentAssets.map((asset, index) => (
                                    <motion.button 
                                        key={`${selectedChain.chainId}-${asset.symbol}`}
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: index * 0.03 }}
                                        onClick={() => handleTokenClick(asset)}
                                        className="w-full flex items-center justify-between p-4 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.08] transition-all group active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <TokenLogoDynamic 
                                                    logoUrl={asset.iconUrl} 
                                                    alt={asset.symbol} 
                                                    size={44} 
                                                    chainId={asset.chainId} 
                                                    symbol={asset.symbol} 
                                                    name={asset.name}
                                                />
                                                {/* DYNAMIC NETWORK BADGE - SHOWS NATIVE COIN OF THE CHAIN */}
                                                <div className="absolute -bottom-1 -right-1 bg-black rounded-xl p-1 border border-white/10 shadow-2xl z-10">
                                                    <TokenLogoDynamic 
                                                        logoUrl={selectedChain.iconUrl} 
                                                        alt="chain" 
                                                        size={14} 
                                                        chainId={selectedChain.chainId} 
                                                        symbol={selectedChain.symbol}
                                                        name={selectedChain.name}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <p className="font-black text-base text-white tracking-tight">{asset.symbol}</p>
                                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">{asset.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-sm font-black text-white">
                                                {parseFloat(asset.balance).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                                            </p>
                                            <div className="flex items-center justify-end gap-1 opacity-20 group-hover:opacity-60 transition-opacity">
                                                <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Available</span>
                                                <ArrowRight className="w-2 h-2" />
                                            </div>
                                        </div>
                                    </motion.button>
                                ))}
                            </AnimatePresence>
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
