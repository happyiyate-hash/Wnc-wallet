'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useWallet } from '@/contexts/wallet-provider';
import { logoSupabase } from '@/lib/supabase/logo-client';
import { Search, Loader2, Info, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import type { AssetRow } from '@/lib/types';
import { getInitialAssets } from '@/lib/wallets/balances';

interface TokenManagerProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function TokenManager({ isOpen, onOpenChange }: TokenManagerProps) {
  const { viewingNetwork, hiddenTokenKeys, toggleTokenVisibility, addUserToken } = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  const [dbTokens, setDbTokens] = useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch Tokens for current network from Logo Database (token_metadata table)
  useEffect(() => {
    async function fetchMetadata() {
      if (!isOpen || !logoSupabase || !viewingNetwork) return;
      
      setIsLoading(true);
      try {
        const networkSlug = viewingNetwork.name.split(' ')[0].toLowerCase();
        const { data, error } = await logoSupabase
          .from('token_metadata')
          .select('token_details, contract_address, network, logo_url')
          .eq('network', networkSlug);

        if (!error && data) {
          const formatted = data.map(token => ({
            chainId: viewingNetwork.chainId,
            address: token.contract_address?.toLowerCase().trim(),
            symbol: token.token_details.symbol,
            name: token.token_details.name,
            decimals: token.token_details.decimals || 18,
            iconUrl: token.logo_url,
            balance: '0',
            isNative: false,
            priceSource: token.token_details.priceSource || 'coingecko',
            priceId: token.token_details.priceId || token.token_details.coingeckoId,
            coingeckoId: token.token_details.priceId || token.token_details.coingeckoId
          } as AssetRow));
          setDbTokens(formatted);
        }
      } catch (e) {
        console.warn("Metadata fetch error:", e);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetadata();
  }, [isOpen, viewingNetwork]);

  // 2. Merge Hardcoded + Database tokens
  const mergedTokens = useMemo(() => {
    if (!viewingNetwork) return [];
    const hardcoded = getInitialAssets(viewingNetwork.chainId).map(a => ({
        ...a,
        balance: '0'
    } as AssetRow));

    const combined = [...hardcoded, ...dbTokens];
    // Remove duplicates by identifier (address or symbol)
    return combined.reduce((acc, curr) => {
        const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
        if (!acc.find(t => (t.isNative ? t.symbol : t.address?.toLowerCase()) === identifier)) {
            acc.push(curr);
        }
        return acc;
    }, [] as AssetRow[]);
  }, [viewingNetwork, dbTokens]);

  const filteredTokens = mergedTokens.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.address && t.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleToggle = (token: AssetRow, checked: boolean) => {
    if (checked) {
        addUserToken(token);
    }
    toggleTokenVisibility(viewingNetwork.chainId, token.symbol);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[85vh] overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[#0a0a0c]/60 backdrop-blur-3xl -z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />

        <div className="flex flex-col h-full relative z-10">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
            
            <SheetHeader className="px-6 mb-4">
              <SheetTitle className="text-2xl font-black uppercase tracking-widest text-center">Manage Assets</SheetTitle>
              <SheetDescription className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                {viewingNetwork?.name} ecosystem
              </SheetDescription>
            </SheetHeader>

            <div className="px-6 mb-6">
                <div className="p-[1px] bg-gradient-to-r from-primary/50 to-purple-500/50 rounded-2xl">
                    <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-2xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search asset or paste address"
                          className="w-full h-14 bg-transparent border-none pl-11 rounded-2xl focus-visible:ring-0 text-base"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1 px-6 pb-12">
              <div className="space-y-2 pb-20">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Discovering assets...</p>
                    </div>
                ) : filteredTokens.length > 0 ? (
                    filteredTokens.map((token) => {
                        const isHidden = hiddenTokenKeys.has(`${viewingNetwork.chainId}:${token.symbol}`);
                        return (
                            <div 
                                key={token.isNative ? token.symbol : token.address}
                                className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic 
                                        logoUrl={token.iconUrl} 
                                        alt={token.symbol} 
                                        size={40} 
                                        chainId={token.chainId} 
                                        symbol={token.symbol} 
                                        name={token.name}
                                    />
                                    <div className="text-left leading-tight">
                                        <p className="font-bold text-sm text-white">{token.symbol}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                                            {token.isNative ? 'Native Network Asset' : `${token.address?.slice(0,6)}...${token.address?.slice(-4)}`}
                                        </p>
                                    </div>
                                </div>
                                <Switch 
                                    checked={!isHidden} 
                                    onCheckedChange={(checked) => handleToggle(token, checked)}
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                            <Info className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground font-bold">No assets found</p>
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">Try a different search term</p>
                    </div>
                )}
              </div>
            </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
