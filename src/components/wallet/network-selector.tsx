'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Copy, Repeat, Grip, Search, CheckCircle } from 'lucide-react';
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

  // The user provided code expects a themeColor, we'll use a default since it's removed
  const themeColor = '#8A2BE2'; // A default purple color

  const cardStyle = {
    backgroundColor: themeColor ? `${themeColor}30` : 'hsl(var(--muted))',
    borderColor: themeColor || 'hsl(var(--border))',
  };
  
  return (
    <div
      style={cardStyle}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium border'
      )}
    >
      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-background/50 flex items-center justify-center">
            <TokenLogoDynamic 
                alt={chain.name} 
                logoUrl={chain.iconUrl}
                size={32}
                chainId={chain.chainId}
                FallbackComponent={<GenericCoinIcon />}
            />
        </div>
      <div className="flex-1 cursor-pointer" onClick={() => onSelect(chain)}>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-base text-foreground">{chain.name}</p>
          {isSelected && <CheckCircle className="w-4 h-4 text-green-400" />}
        </div>
        <p className="text-xs text-muted-foreground">{shortAddress}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 bg-foreground/5 hover:bg-foreground/10"
          onClick={(e) => {
            e.stopPropagation();
            address && onCopy(address);
          }}
          disabled={!address}
        >
          <Copy className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
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
    chain.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (!isClient || !isInitialized) {
    return (
      <Button
        variant="ghost"
        className={cn('flex items-center gap-1 p-1 h-auto', className)}
        disabled
      >
        <div className="w-6 h-6 bg-muted rounded-full animate-pulse" />
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className={cn('flex items-center gap-1 p-1 h-auto', className)}
          disabled={!isInitialized}
        >
          <TokenLogoDynamic 
            alt={viewingNetwork.name} 
            logoUrl={viewingNetwork.iconUrl}
            size={24}
            chainId={viewingNetwork.chainId}
            FallbackComponent={<GenericCoinIcon />}
          />
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="h-[90vh] flex flex-col bg-black text-white rounded-t-2xl p-0"
      >
        <SheetHeader className="p-4 pt-2 text-center border-b border-zinc-800">
          <SheetTitle className="sr-only">Select a network</SheetTitle>
          <div className="w-full flex justify-center">
            <Grip className="h-5 w-10 text-muted-foreground" />
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search networks"
              className="w-full bg-zinc-900 border-zinc-700 pl-9 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </SheetHeader>

        <p className="px-4 pt-4 pb-2 text-sm font-semibold text-muted-foreground">
          All Networks
        </p>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3">
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

        <div className="p-4 mt-auto border-t border-zinc-800">
          <Button variant="secondary" className="w-full">
            Add a custom network
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
