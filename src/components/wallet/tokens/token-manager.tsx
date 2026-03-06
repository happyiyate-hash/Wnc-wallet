
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useWallet } from '@/contexts/wallet-provider';
import { Search, Loader2, Info, Plus, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import type { AssetRow } from '@/lib/types';
import { getInitialAssets } from '@/lib/wallets/balances';
import { fetchNetworkTokens } from '@/lib/getTokenLogo';
import { cn } from '@/lib/utils';

interface TokenManagerProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

/**
 * INSTITUTIONAL ASSET MANAGER
 * Version: 3.1.0 (Non-Blocking Silent Discovery)
 * Independent of auth process. Prioritizes hardcoded nodes.
 */
export default function TokenManager({ isOpen, onOpenChange }: TokenManagerProps) {
  const { viewingNetwork, hiddenTokenKeys, toggleTokenVisibility, addUserToken, userAddedTokens, refresh } = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  const [dbTokens, setDbTokens] = useState<AssetRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    async function discover() {
      if (!isOpen || !viewingNetwork) return;
      
      setIsSearching(true);
      try {
        const networkSlug = viewingNetwork.name.toLowerCase();
        // SEARCH DIRECTLY FROM LOGO CDN REGISTRY (Server Action)
        const tokens = await fetchNetworkTokens(networkSlug);

        if (tokens && tokens.length > 0) {
          const formatted = tokens.map(t => ({
            chainId: viewingNetwork.chainId,
            address: t.contract?.toLowerCase().trim(),
            symbol: t.symbol,
            name: t.name,
            decimals: t.decimals || 18,
            iconUrl: t.logo_url,
            balance: '0',
            isNative: false,
            priceSource: t.priceSource || 'coingecko',
            priceId: t.priceId
          } as AssetRow));
          setDbTokens(formatted);
        }
      } catch (e) {
        // Handshake deferred
      } finally {
        setIsSearching(false);
      }
    }

    discover();
  }, [isOpen, viewingNetwork]);

  const mergedTokens = useMemo(() => {
    if (!viewingNetwork) return [];
    
    // 1. Load Hardcoded Assets (Instant Handshake)
    const hardcoded = getInitialAssets(viewingNetwork.chainId).map(a => ({
        ...a,
        balance: '0'
    } as AssetRow));

    // 2. Merge with Registry Discovered Assets
    const combined = [...hardcoded, ...dbTokens];
    return combined.reduce((acc, curr) => {
        const identifier = curr.isNative ? curr.symbol : curr.address?.toLowerCase();
        if (!acc.find(t => (t.isNative ? t.symbol : t.address?.toLowerCase()) === identifier)) {
            acc.push(curr);
        }
        return acc;
    }, [] as AssetRow[]);
  }, [viewingNetwork, dbTokens]);

  const filteredTokens = useMemo(() => {
    return mergedTokens.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.address && t.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [mergedTokens, searchTerm]);

  const handleToggle = async (token: AssetRow, checked: boolean) => {
    const key = `${viewingNetwork.chainId}:${token.symbol}`;
    const isAdded = userAddedTokens.some(t => t.chainId === viewingNetwork.chainId && t.symbol === token.symbol);

    if (checked) {
        if (!token.isNative && !isAdded) {
            addUserToken({
                ...token,
                balance: '0',
                updatedAt: Date.now()
            });
        }
        if (hiddenTokenKeys.has(key)) {
            toggleTokenVisibility(viewingNetwork.chainId, token.symbol);
        }
        setTimeout(() => refresh(), 100);
    } else {
        if (!hiddenTokenKeys.has(key)) {
            toggleTokenVisibility(viewingNetwork.chainId, token.symbol);
        }
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[85vh] overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-black/80 -z-10" />

        <div className="flex flex-col h-full relative z-10">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
            
            <SheetHeader className="px-6 mb-4">
              <SheetTitle className="text-2xl font-black uppercase tracking-widest text-center">Registry Assets</SheetTitle>
              <SheetDescription className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                {viewingNetwork?.name} Node Handshake
              </SheetDescription>
            </SheetHeader>

            <div className="px-6 mb-6 flex items-center gap-3">
                <div className="relative flex-1 bg-white/5 border border-white/10 rounded-2xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search asset or contract..."
                      className="w-full h-14 bg-transparent border-none pl-11 rounded-2xl focus-visible:ring-0 text-base"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {isSearching && <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
            </div>

            <ScrollArea className="flex-1 px-6">
              <div className="space-y-2 pb-32">
                {filteredTokens.map((token) => {
                    const key = `${viewingNetwork.chainId}:${token.symbol}`;
                    const isAdded = userAddedTokens.some(t => t.chainId === viewingNetwork.chainId && t.symbol === token.symbol);
                    const isHidden = hiddenTokenKeys.has(key);
                    const isOn = (token.isNative || isAdded) && !isHidden;

                    return (
                        <div key={token.isNative ? token.symbol : token.address} className="flex items-center justify-between p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                            <div className="flex items-center gap-4">
                                <TokenLogoDynamic logoUrl={token.iconUrl} alt={token.symbol} size={44} chainId={token.chainId} symbol={token.symbol} name={token.name} />
                                <div className="text-left"><p className="font-bold text-base text-white">{token.symbol}</p><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-40">{token.isNative ? 'Native Gas Node' : token.name}</p></div>
                            </div>
                            <Switch checked={isOn} onCheckedChange={(checked) => handleToggle(token, checked)} className="data-[state=checked]:bg-primary" />
                        </div>
                    );
                })}
              </div>
            </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
