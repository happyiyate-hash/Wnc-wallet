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
            <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[92vw] max-w-[440px] h-[70vh] bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-0 overflow-hidden shadow-2xl z-[150] gap-0 flex flex-col">
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <DialogDescription className="sr-only">Floating asset control panel for institutional transfers.</DialogDescription>

                {/* HEADER COCKPIT */}
                <div className="p-6 border-b border-white/5 space-y-4 shrink-0 bg-gradient-to-b from-white/[0.02] to-transparent">
                    <div className="flex items-center justify-between gap-3">
                        {/* NETWORK SWITCHER DROPDOWN (LEFT) */}
                        <button 
                            onClick={() => setIsNetworkListOpen(!isNetworkListOpen)}
                            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all active:scale-95 shrink-0"
                        >
                            <TokenLogoDynamic 
                                logoUrl={selectedChain.iconUrl} 
                                alt={selectedChain.name} 
                                size={18} 
                                chainId={selectedChain.chainId} 
                                symbol={selectedChain.symbol}
                                name={selectedChain.name}
                            />
                            <span className="text-[10px] font-black uppercase text-white tracking-tighter">{selectedChain.name}</span>
                            <ChevronDown className={cn("w-3 h-3 text-primary transition-transform duration-300", isNetworkListOpen && "rotate-180")} />
                        </button>

                        {/* IDENTITY NODE (RIGHT - MASKED) */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 group min-w-0">
                            <Cpu className="w-3 h-3 text-primary opacity-40 shrink-0" />
                            <p className="text-[10px] font-mono text-white/40 truncate">
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
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                        <Input 
                            placeholder={isNetworkListOpen ? "Search networks..." : "Search assets..."}
                            className="bg-white/5 border-white/10 pl-11 h-12 rounded-2xl focus-visible:ring-primary text-sm placeholder:text-white/10"
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
                                className="absolute inset-0 z-20 bg-[#0a0a0c] p-4 overflow-hidden flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Select Ecosystem</span>
                                    <button onClick={() => setIsNetworkListOpen(false)} className="text-white/20 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                                </div>
                                <ScrollArea className="flex-1">
                                    <div className="grid grid-cols-2 gap-2 pb-10">
                                        {filteredChains.map((chain) => (
                                            <button 
                                                key={chain.chainId}
                                                onClick={() => { setSelectedNetwork(chain); setIsNetworkListOpen(false); }}
                                                className={cn(
                                                    "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all active:scale-95",
                                                    selectedChain.chainId === chain.chainId 
                                                        ? "bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(139,92,246,0.1)]" 
                                                        : "bg-white/5 border-white/5 hover:bg-white/10"
                                                )}
                                            >
                                                <TokenLogoDynamic logoUrl={chain.iconUrl} alt={chain.name} size={32} chainId={chain.chainId} name={chain.name} symbol={chain.symbol} />
                                                <p className="font-black text-[10px] uppercase tracking-tight text-white line-clamp-1">{chain.name}</p>
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* MAIN TOKEN LIST */}
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-1 pb-24">
                            <AnimatePresence mode="popLayout">
                                {currentAssets.map((asset, index) => (
                                    <motion.button 
                                        key={`${selectedChain.chainId}-${asset.symbol}`}
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: index * 0.03 }}
                                        onClick={() => handleTokenClick(asset)}
                                        className="w-full flex items-center justify-between p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] transition-all group active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <TokenLogoDynamic 
                                                    logoUrl={asset.iconUrl} 
                                                    alt={asset.symbol} 
                                                    size={40} 
                                                    chainId={asset.chainId} 
                                                    symbol={asset.symbol} 
                                                    name={asset.name}
                                                />
                                                <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-0.5 border border-white/10 shadow-lg">
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
                                                <p className="font-bold text-sm text-white">{asset.symbol}</p>
                                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">{asset.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-xs font-bold text-white">
                                                {parseFloat(asset.balance).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                                            </p>
                                            <div className="flex items-center justify-end gap-1 opacity-40">
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
