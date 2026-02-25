
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Search, CheckCircle2, Copy, ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/contexts/wallet-provider';
import type { ChainConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { Skeleton } from '../ui/skeleton';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

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
        borderColor: `${themeColor}80`, // Even brighter border
        background: `linear-gradient(135deg, ${themeColor}40 0%, rgba(0,0,0,0.7) 100%)`, // More vibrant background
      }}
      className={cn(
        'w-full flex items-center justify-between py-3 px-4 rounded-[1.5rem] border transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden mb-2',
        isSelected && "border-primary/90 shadow-[0_0_40px_rgba(129,140,248,0.25)]"
      )}
      role="button"
    >
      <div className="flex items-center gap-3 relative z-10">
        <div className="p-0.5 rounded-full bg-white/10">
            <TokenLogoDynamic 
                alt={chain.name} 
                logoUrl={chain.iconUrl}
                size={32} // Scaled down icon for slimer profile
                chainId={chain.chainId}
                name={chain.name}
                symbol={chain.symbol}
                FallbackComponent={<GenericCoinIcon />}
            />
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <p className="font-black text-sm text-white tracking-tight leading-none">{chain.name}</p>
            <span className="text-[8px] text-white/40 font-black uppercase tracking-widest">ID: {chain.chainId}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <p className={cn(
                "font-mono text-[10px] tracking-tighter transition-colors opacity-60",
                isCopied ? "text-green-400 opacity-100" : "text-white"
            )}>
                {shortAddress}
            </p>
            {address && (
                <button 
                    onClick={handleCopy}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors text-primary"
                >
                    {isCopied ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 relative z-10 pr-1">
        {isSelected ? (
          <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center border border-primary/40">
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}
      </div>
      
      {/* Subtle background glow */}
      <div 
        className="absolute -right-4 -top-4 w-20 h-20 blur-2xl opacity-30 transition-opacity group-hover:opacity-50"
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

  const filteredChains = allChains.filter((chain) =>
    chain.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    chain.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (!isClient || !isInitialized || !viewingNetwork) {
    return (
      <Button variant="ghost" className={cn('flex items-center gap-1 p-1 h-auto', className)} disabled>
        <Skeleton className="w-6 h-6 rounded-full" />
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className={cn('flex items-center gap-2 p-1 h-auto hover:bg-white/5 rounded-full transition-colors', className)}
        >
          <TokenLogoDynamic 
            alt={viewingNetwork.name} 
            logoUrl={viewingNetwork.iconUrl}
            size={24}
            chainId={viewingNetwork.chainId}
            name={viewingNetwork.name}
            symbol={viewingNetwork.symbol}
            FallbackComponent={<GenericCoinIcon />}
          />
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="h-[90vh] flex flex-col bg-transparent text-white rounded-t-[3.5rem] p-0 border-t border-primary/20 overflow-hidden shadow-2xl"
      >
        {/* Deep immersive background */}
        <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl -z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-black/80 -z-10" />

        <div className="flex flex-col h-full relative z-10 overflow-hidden">
            <SheetHeader className="p-6 pt-10 text-center shrink-0">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
              <SheetTitle className="text-3xl font-black uppercase tracking-[0.15em] mb-8 text-white">Select Network</SheetTitle>
              <div className="relative px-2">
                <div className="p-[1px] bg-gradient-to-r from-primary/40 via-purple-500/40 to-primary/40 rounded-2xl">
                    <div className="relative bg-zinc-900/90 backdrop-blur-2xl rounded-2xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                        <Input
                          placeholder="Search 21+ networks..."
                          className="w-full h-16 bg-transparent border-none pl-12 rounded-2xl focus-visible:ring-0 text-lg placeholder:text-white/20"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 px-3">
              <div className="pb-32 pt-4">
                {filteredChains.map((chain) => (
                    <NetworkRow
                      key={chain.chainId}
                      chain={chain}
                      isSelected={viewingNetwork?.chainId === chain.chainId}
                      onSelect={handleNetworkSelect}
                      address={wallets ? getAddressForChain(chain, wallets) : undefined}
                    />
                ))}
              </div>
            </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
