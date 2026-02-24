
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Copy, Search, CheckCircle2 } from 'lucide-react';
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

  const themeColor = chain.themeColor || '#818cf8';

  return (
    <div
      onClick={() => onSelect(chain)}
      style={{
        borderColor: themeColor,
        borderWidth: '2px',
        background: `linear-gradient(135deg, ${themeColor}25 0%, rgba(0,0,0,0) 100%)`,
      }}
      className={cn(
        'w-full flex items-center gap-3 p-3.5 rounded-2xl text-sm font-medium border transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden',
        isSelected && "shadow-lg"
      )}
      role="button"
    >
      <div className="flex-shrink-0 relative z-10">
            <TokenLogoDynamic 
                alt={chain.name} 
                logoUrl={chain.iconUrl}
                size={44}
                chainId={chain.chainId}
                name={chain.name}
                symbol={chain.symbol}
                FallbackComponent={<GenericCoinIcon />}
            />
        </div>
      <div className="flex-1 relative z-10">
        <div className="flex items-center gap-2">
          <p className="font-bold text-base text-white">{chain.name}</p>
          {isSelected && <CheckCircle2 className="w-4 h-4 text-primary fill-primary/10" />}
        </div>
        <p className="text-[11px] text-muted-foreground font-mono opacity-60">{shortAddress}</p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-muted-foreground hover:text-white transition-colors relative z-10"
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
        className="h-[80vh] flex flex-col bg-transparent text-white rounded-t-[3.5rem] p-0 border-t border-primary/20 overflow-hidden shadow-2xl"
      >
        <div className="absolute inset-0 bg-[#0a0a0c]/60 backdrop-blur-3xl -z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />

        <div className="flex flex-col h-full relative z-10 overflow-hidden">
            <SheetHeader className="p-6 pt-4 text-center shrink-0">
              <SheetTitle className="sr-only">Select a network</SheetTitle>
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
              <div className="relative px-4">
                <div className="p-[1px] bg-gradient-to-r from-primary/50 to-purple-500/50 rounded-2xl">
                    <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-2xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search 23+ networks"
                          className="w-full h-14 bg-transparent border-none pl-11 rounded-2xl focus-visible:ring-0 text-base"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 px-4">
              <div className="space-y-3 pb-12 pt-2">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
