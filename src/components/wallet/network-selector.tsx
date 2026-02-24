'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Copy, Search, CheckCircle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { getAddressForChain } from '@/lib/wallets/utils';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { Skeleton } from '../ui/skeleton';

interface NetworkSelectorProps {
  className?: string;
}

const NetworkRow = ({
  chain,
  address,
  isSelected,
  onSelect,
  onCopy,
}: {
  chain: ChainConfig;
  address: string | null;
  isSelected: boolean;
  onSelect: (chain: ChainConfig) => void;
  onCopy: (address: string) => void;
}) => {
  const shortAddress = address
    ? `${address.slice(0, 8)}...${address.slice(-8)}`
    : 'Connecting...';

  // Extract theme color or default to primary
  const themeColor = chain.themeColor || '#818cf8';

  return (
    <div
      onClick={() => onSelect(chain)}
      style={{
        borderColor: isSelected ? `${themeColor}60` : undefined,
        background: isSelected 
          ? `linear-gradient(135deg, ${themeColor}20 0%, ${themeColor}05 100%)` 
          : undefined
      }}
      className={cn(
        'w-full flex items-center gap-3 p-4 rounded-2xl text-sm font-medium border transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden',
        isSelected 
          ? "border-2 shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)] shadow-primary/10" 
          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
      )}
      role="button"
    >
      {isSelected && (
        <div 
          className="absolute -right-4 -top-4 w-12 h-12 rounded-full blur-2xl opacity-20"
          style={{ backgroundColor: themeColor }}
        />
      )}

      <div className="flex-shrink-0 relative z-10">
            <TokenLogoDynamic 
                alt={chain.name} 
                logoUrl={chain.iconUrl}
                size={40}
                chainId={chain.chainId}
                name={chain.name}
                symbol={chain.symbol}
                FallbackComponent={<GenericCoinIcon />}
            />
        </div>
      <div className="flex-1 relative z-10">
        <div className="flex items-center gap-2">
          <p className="font-bold text-base text-foreground group-hover:text-white transition-colors">{chain.name}</p>
          {isSelected && <CheckCircle className="w-4 h-4" style={{ color: themeColor }} />}
        </div>
        <p className="text-xs text-muted-foreground font-mono opacity-70">{shortAddress}</p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-muted-foreground hover:text-primary transition-colors relative z-10"
        onClick={(e) => {
          e.stopPropagation();
          address && onCopy(address);
        }}
        disabled={!address}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default function NetworkSelector({ className }: NetworkSelectorProps) {
  const { viewingNetwork, setNetwork, wallets, isInitialized, allChains } = useWallet();
  const { toast } = useToast();
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

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast({
      title: 'Address Copied!',
      description: 'Your wallet address has been copied to the clipboard.',
    });
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
          disabled={!isInitialized}
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
        className="h-[90vh] flex flex-col bg-zinc-950 text-white rounded-t-[2.5rem] p-0 border-t border-white/10"
      >
        <SheetHeader className="p-6 pt-4 text-center">
          <SheetTitle className="sr-only">Select a network</SheetTitle>
          <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search 23+ networks"
              className="w-full h-14 bg-white/5 border-white/10 pl-11 rounded-2xl focus-visible:ring-primary text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </SheetHeader>

        <p className="px-6 pb-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
          Available Ecosystems
        </p>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 pb-8">
            {filteredChains.map((chain) => {
              const displayAddress = wallets ? getAddressForChain(chain, wallets) : null;
              const isSelected = viewingNetwork?.chainId === chain.chainId;

              return (
                <NetworkRow
                  key={chain.chainId}
                  chain={chain}
                  address={displayAddress || ''}
                  isSelected={isSelected}
                  onSelect={handleNetworkSelect}
                  onCopy={handleCopyAddress}
                />
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
