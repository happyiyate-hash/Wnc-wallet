
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
        borderColor: `${themeColor}40`,
        background: `linear-gradient(135deg, ${themeColor}15 0%, rgba(0,0,0,0.4) 100%)`,
      }}
      className={cn(
        'w-full flex items-center justify-between p-4 rounded-[2rem] border transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden mb-2',
        isSelected && "border-primary/50 shadow-[0_0_20px_rgba(129,140,248,0.1)]"
      )}
      role="button"
    >
      <div className="flex items-center gap-4 relative z-10">
        <TokenLogoDynamic 
            alt={chain.name} 
            logoUrl={chain.iconUrl}
            size={44}
            chainId={chain.chainId}
            name={chain.name}
            symbol={chain.symbol}
            FallbackComponent={<GenericCoinIcon />}
        />
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <p className="font-black text-base text-white tracking-tight leading-none">{chain.name}</p>
            <span className="text-[9px] text-muted-foreground/40 font-mono">ID: {chain.chainId}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="font-mono text-[10px] text-muted-foreground/60 tracking-tight">
                {shortAddress}
            </p>
            {address && (
                <button 
                    onClick={handleCopy}
                    className="p-1 rounded-md hover:bg-white/10 transition-colors text-primary"
                >
                    <Copy className="w-3 h-3" />
                </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 relative z-10">
        {isSelected ? (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-1 transition-all" />
        )}
      </div>
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
        className="h-[85vh] flex flex-col bg-transparent text-white rounded-t-[3.5rem] p-0 border-t border-primary/20 overflow-hidden shadow-2xl"
      >
        <div className="absolute inset-0 bg-[#0a0a0c]/90 backdrop-blur-3xl -z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-transparent to-black/80 -z-10" />

        <div className="flex flex-col h-full relative z-10 overflow-hidden">
            <SheetHeader className="p-6 pt-8 text-center shrink-0">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
              <SheetTitle className="text-2xl font-black uppercase tracking-widest mb-6">Select Network</SheetTitle>
              <div className="relative px-4">
                <div className="p-[1px] bg-gradient-to-r from-primary/50 to-purple-500/50 rounded-2xl">
                    <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-2xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search 23+ networks..."
                          className="w-full h-14 bg-transparent border-none pl-11 rounded-2xl focus-visible:ring-0 text-base"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 px-6">
              <div className="pb-32 pt-2">
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
