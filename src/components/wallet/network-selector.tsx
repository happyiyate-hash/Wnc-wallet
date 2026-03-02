
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Search, CheckCircle2, Copy, ChevronRight, X, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/contexts/wallet-provider';
import type { ChainConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { Skeleton } from '../ui/skeleton';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { motion, AnimatePresence } from 'framer-motion';

interface NetworkSelectorProps {
  className?: string;
}

const NetworkRow = ({
  chain,
  isSelected,
  onSelect,
  address,
}: {
  chain: ChainConfig;
  isSelected: boolean;
  onSelect: (chain: ChainConfig) => void;
  address?: string;
}) => {
  const [isCopied, copy] = useCopyToClipboard();
  const themeColor = chain.themeColor || '#818cf8';

  const shortAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}` 
    : 'Initializing...';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (address) copy(address);
  };

  return (
    <div
      onClick={() => onSelect(chain)}
      style={{
        borderColor: `${themeColor}40`,
        background: `linear-gradient(135deg, ${themeColor}15 0%, rgba(0,0,0,0.4) 100%)`,
      }}
      className={cn(
        'w-full flex items-center justify-between py-4 px-5 rounded-[2rem] border transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden mb-2',
        isSelected && "border-primary/60 bg-primary/5 shadow-[0_0_30px_rgba(129,140,248,0.1)]"
      )}
      role="button"
    >
      <div className="flex items-center gap-4 relative z-10">
        <div className="p-0.5 rounded-full bg-white/5 border border-white/5">
            <TokenLogoDynamic 
                alt={chain.name} 
                logoUrl={chain.iconUrl}
                size={36}
                chainId={chain.chainId}
                name={chain.name}
                symbol={chain.symbol}
                FallbackComponent={<GenericCoinIcon />}
            />
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <p className="font-black text-sm text-white tracking-tight leading-none">{chain.name}</p>
            <span className="text-[8px] text-white/30 font-black uppercase tracking-widest">{chain.symbol}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <p className={cn(
                "font-mono text-[9px] tracking-tighter transition-colors opacity-40",
                isCopied ? "text-green-400 opacity-100" : "text-white"
            )}>
                {shortAddress}
            </p>
            {address && (
                <button 
                    onClick={handleCopy}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors text-primary/60 hover:text-primary"
                >
                    {isCopied ? <CheckCircle2 className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 relative z-10">
        {isSelected ? (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-20 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}
      </div>
      
      {/* Dynamic Background Glow */}
      <div 
        className="absolute -right-10 -top-10 w-24 h-24 blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"
        style={{ backgroundColor: themeColor }}
      />
    </div>
  );
};

export default function NetworkSelector({ className }: NetworkSelectorProps) {
  const { viewingNetwork, setNetwork, isInitialized, allChains, wallets, getAddressForChain } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleNetworkSelect = (newNetwork: ChainConfig) => {
    setNetwork(newNetwork);
    setIsOpen(false);
  };

  const filteredChains = useMemo(() => {
    return allChains.filter((chain) =>
      chain.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      chain.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allChains, searchTerm]);
  
  if (!isClient || !isInitialized || !viewingNetwork) {
    return (
      <Button variant="ghost" className={cn('flex items-center gap-1 p-1 h-auto', className)} disabled>
        <Skeleton className="w-6 h-6 rounded-full" />
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(true)}
        className={cn('flex items-center gap-1 p-1 h-auto hover:bg-white/5 rounded-full transition-all active:scale-95', className)}
      >
        <div className="relative p-0.5 rounded-full bg-white/5 border border-white/5">
            <TokenLogoDynamic 
                alt={viewingNetwork.name} 
                logoUrl={viewingNetwork.iconUrl}
                size={22}
                chainId={viewingNetwork.chainId}
                name={viewingNetwork.name}
                symbol={viewingNetwork.symbol}
                FallbackComponent={<GenericCoinIcon />}
            />
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent 
            className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[92vw] max-w-[440px] h-[75vh] bg-gradient-to-br from-zinc-900/40 via-black/95 to-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-0 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] z-[150] gap-0 flex flex-col"
            onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Select Network</DialogTitle>
          <DialogDescription className="sr-only">Switch between supported blockchain ecosystems.</DialogDescription>

          <div className="p-6 border-b border-white/5 space-y-4 shrink-0 bg-white/[0.02]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <Globe className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Network Hub</h3>
                        <p className="text-[8px] font-black uppercase text-primary opacity-60">Identity Synchronization</p>
                    </div>
                </div>
                {/* Manual close button removed to avoid duplication with Dialog builtin 'X' */}
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                <Input
                  placeholder="Search ecosystem..."
                  className="w-full h-14 bg-black/40 border-white/10 pl-11 rounded-2xl focus-visible:ring-primary text-base placeholder:text-white/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-1 py-4 pb-20">
              <AnimatePresence mode="popLayout">
                {filteredChains.map((chain, index) => (
                    <motion.div
                        key={chain.chainId}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                    >
                        <NetworkRow
                          chain={chain}
                          isSelected={viewingNetwork?.chainId === chain.chainId}
                          onSelect={handleNetworkSelect}
                          address={wallets ? getAddressForChain(chain, wallets) : undefined}
                        />
                    </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>

          <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black to-transparent pointer-events-none z-20" />
        </DialogContent>
      </Dialog>
    </>
  );
}
