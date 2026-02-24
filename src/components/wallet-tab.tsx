'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  ArrowUpFromLine,
  ArrowDownToLine,
  Loader2,
  Repeat,
  Sparkles,
  MoreHorizontal,
  AlertCircle,
  ChevronRight,
  Wallet as WalletIcon,
  Copy,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/wallet-provider';
import type { AssetRow, ChainConfig } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import TokenManager from '@/components/wallet/tokens/token-manager';
import NotificationCenter from '@/components/notifications/notification-center';
import { useUser } from '@/contexts/user-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TokenLogoDynamic from './shared/TokenLogoDynamic';
import MoreActionsSheet from './wallet/more-actions-sheet';
import ApiKeyRequestSheet from './wallet/api-key-request-sheet';
import { Skeleton } from './ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getInitialAssets } from '@/lib/wallets/balances';
import { getAddressForChain } from '@/lib/wallets/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';

const TokenRow = ({ token, isLoading, themeColor }: { token: AssetRow, isLoading: boolean, themeColor?: string }) => {
  const router = useRouter();
  const isPositiveChange = (token.pctChange24h ?? 0) >= 0;
  const color = themeColor || '#818cf8';

  const handleRowClick = () => {
    router.push(`/token-details?symbol=${encodeURIComponent(token.symbol ?? '')}`);
  };

  return (
    <div
      onClick={handleRowClick}
      style={{
        borderColor: color,
        borderWidth: '2px',
        background: `linear-gradient(135deg, ${color}25 0%, rgba(0,0,0,0) 100%)`,
        boxShadow: `0 4px 20px -10px ${color}30`
      }}
      className="flex cursor-pointer items-center justify-between p-3.5 rounded-2xl border mb-3 mx-4 hover:scale-[1.01] active:scale-[0.98] transition-all group relative overflow-hidden"
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-4 relative z-10">
        <TokenLogoDynamic 
            alt={token.name} 
            logoUrl={token.iconUrl}
            symbol={token.symbol}
            name={token.name}
            size={44}
            chainId={token.chainId}
        />
        <div className="flex flex-col">
          <p className="font-black text-base text-white tracking-tight">{token.name}</p>
          <p
            className={cn(
              'text-[10px] font-black uppercase tracking-[0.1em]',
              isPositiveChange ? 'text-green-400' : 'text-red-400'
            )}
          >
            {isPositiveChange ? '▲' : '▼'} {(token.pctChange24h ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>
      <div className="text-right relative z-10">
        {isLoading ? (
          <div className="space-y-1.5">
            <Loader2 className="h-4 w-4 animate-spin ml-auto text-primary" />
            <Skeleton className="h-3 w-24 ml-auto bg-white/5" />
          </div>
        ) : (
          <>
            <p className="font-black text-lg text-white leading-none">
              {parseFloat(token.balance || '0').toLocaleString('en-US', {
                maximumFractionDigits: 6,
              })}{' '}
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold ml-1">{token.symbol}</span>
            </p>
            <p className="text-[11px] font-bold text-muted-foreground/60 mt-1.5 uppercase tracking-tighter">
              ≈ ${(token.fiatValueUsd ?? 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </>
        )}
      </div>
      <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
          <ChevronRight className="w-12 h-12 text-white" />
      </div>
    </div>
  );
};

export default function WalletTab() {
  const { wallets, isInitialized, allAssets, isRefreshing, isTokenLoading, refresh, viewingNetwork, fetchError, infuraApiKey, allChains, allChainsMap, balances } = useWallet();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isTokenManagerOpen, setIsTokenManagerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [isApiKeySheetOpen, setIsApiKeySheetOpen] = useState(false);
  
  // Action sheets
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [actionType, setActionType] = useState<'send' | 'receive' | 'swap'>('send');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  const router = useRouter();

  // Proactively request API key if missing but wallet exists
  useEffect(() => {
    if (isInitialized && !!wallets && !infuraApiKey) {
      const timer = setTimeout(() => {
        setIsApiKeySheetOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, wallets, infuraApiKey]);

  const totalFiatValue = useMemo(() => {
    return allAssets.reduce((sum, asset) => sum + (asset.fiatValueUsd ?? 0), 0);
  }, [allAssets]);
  
  const total24hChange = useMemo(() => {
    if (!allAssets || allAssets.length === 0 || totalFiatValue === 0) return 0;
    
    let totalValueYesterday = 0;
    for (const asset of allAssets) {
      const price = asset.priceUsd ?? 0;
      const change = asset.pctChange24h ?? 0;
      const balance = parseFloat(asset.balance || '0') || 0;
      if (!price || !balance) continue;
      
      const denom = 1 + change / 100;
      if (!isFinite(denom) || denom === 0) continue;
      
      const priceYesterday = price / denom;
      totalValueYesterday += priceYesterday * balance;
    }

    if (totalValueYesterday === 0) return 0;
    const changeValue = totalFiatValue - totalValueYesterday;
    return (changeValue / totalValueYesterday) * 100;
  }, [allAssets, totalFiatValue]);

  const getBalanceFontSize = (balance: number) => {
    const safeBalance = Number.isFinite(balance) ? balance : 0;
    const balanceString = safeBalance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const length = balanceString.length;

    if (length > 16) return 'text-xl';
    if (length > 12) return 'text-2xl';
    if (length > 9) return 'text-3xl';
    return 'text-4xl';
  };

  const openAction = (type: 'send' | 'receive' | 'swap') => {
    setActionType(type);
    setIsActionSheetOpen(true);
  };

  const handleTokenSelect = (token: AssetRow) => {
    setIsTokenSideSheetOpen(false);
    setIsActionSheetOpen(false);
    router.push(`/${actionType}?symbol=${token.symbol}&chainId=${token.chainId}`);
  };

  const ActionButton = ({ icon: Icon, label, onClick }: { icon: React.ElementType, label: string, onClick: () => void }) => (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="default"
        size="icon"
        className="bg-primary hover:bg-primary/90 w-14 h-14 rounded-2xl shadow-xl shadow-primary/20 transition-transform active:scale-90"
        onClick={onClick}
      >
        <Icon className="w-6 h-6 text-primary-foreground" />
      </Button>
      <span className="text-[10px] uppercase font-black tracking-widest text-foreground">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="bg-background pt-8">
        <div className="flex items-center justify-between px-6">
            <div>
              <h2 className={cn(
                'font-black tracking-tighter text-white',
                getBalanceFontSize(Number(totalFiatValue ?? 0))
              )}>
                US${(totalFiatValue || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h2>
              <p
                className={cn(
                  'text-sm font-bold mt-1.5 flex items-center gap-2',
                  total24hChange >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {total24hChange >= 0 ? '+' : ''}$
                {Math.abs(totalFiatValue - (totalFiatValue / (1 + total24hChange / 100 || 1))).toFixed(2)}
                <span className="text-gray-500 font-medium">
                  ({total24hChange >= 0 ? '+' : ''}
                  {total24hChange.toFixed(2)}%)
                </span>
              </p>
            </div>
        </div>

        <div className="flex justify-center gap-4 my-10 px-4">
          <ActionButton icon={ArrowUpFromLine} label="Send" onClick={() => openAction('send')} />
          <ActionButton icon={ArrowDownToLine} label="Receive" onClick={() => openAction('receive')} />
          <ActionButton icon={Repeat} label="Swap" onClick={() => openAction('swap')} />
          <ActionButton icon={Sparkles} label="Buy" onClick={() => router.push('/buy')} />
          <ActionButton icon={MoreHorizontal} label="More" onClick={() => setIsMoreActionsOpen(true)} />
        </div>
        
        <div className="w-full">
            <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 px-6">
                <TabsTrigger
                  value="tokens"
                  className="p-0 pb-3 text-xs uppercase tracking-[0.2em] font-black data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none flex-1 data-[state=active]:border-b-4 data-[state=active]:border-primary transition-all"
                >
                  Tokens
                </TabsTrigger>
                <TabsTrigger value="defi" disabled className="p-0 pb-3 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/30 flex-1">DeFi</TabsTrigger>
                <TabsTrigger value="nfts" disabled className="p-0 pb-3 text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/30 flex-1">NFTs</TabsTrigger>
              </TabsList>
              <TabsContent value="tokens" className="px-0 pt-2">
                <div className="flex items-center justify-between py-6 px-6">
                    <div className="p-[1px] bg-gradient-to-r from-blue-500/50 to-green-500/50 rounded-full">
                        <Button
                            variant="outline"
                            className="h-10 px-5 bg-background hover:bg-muted/50 rounded-full border-none shadow-lg"
                            onClick={() => setIsTokenManagerOpen(true)}
                        >
                            <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent font-black text-[10px] uppercase tracking-[0.1em]">Manage Assets</span>
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 bg-white/5 rounded-full hover:bg-white/10 active:scale-90 transition-all"
                            onClick={() => refresh()}
                            disabled={isRefreshing}
                        >
                          {isRefreshing ? <Loader2 className="h-5 w-5 animate-spin text-primary"/> : <RefreshCw className="h-5 w-5 text-primary"/>}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto thin-scrollbar pb-32">
                  {fetchError && (
                    <div 
                      className="mx-6 mb-6 p-5 rounded-3xl bg-destructive/10 text-destructive text-xs flex items-center gap-4 border border-destructive/20 cursor-pointer active:scale-[0.98] transition-all shadow-2xl"
                      onClick={() => setIsApiKeySheetOpen(true)}
                    >
                      <AlertCircle className="w-6 h-6 shrink-0" />
                      <div className="flex-1">
                        <p className="font-black uppercase tracking-wider mb-0.5">Connection Error</p>
                        <p className="opacity-80 leading-relaxed">Infrastructure link offline. Tap to restore live balance tracking.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    {allAssets.map((token) => (
                      <TokenRow
                        key={`${token.chainId}-${token.address || token.symbol}`}
                        token={token}
                        isLoading={isTokenLoading(token.chainId, token.symbol)}
                        themeColor={allChainsMap[token.chainId]?.themeColor}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
        </div>
      </div>

      <TokenManager isOpen={isTokenManagerOpen} onOpenChange={setIsTokenManagerOpen} />
      <ApiKeyRequestSheet isOpen={isApiKeySheetOpen} onOpenChange={setIsApiKeySheetOpen} />
      {user && <NotificationCenter isOpen={isNotificationsOpen} onOpenChange={setIsNotificationsOpen} userId={user.id}/>}
      <MoreActionsSheet isOpen={isMoreActionsOpen} onOpenChange={setIsMoreActionsOpen} />

      {/* GLOBAL ACTION SHEET (NETWORK -> TOKEN) */}
      <Sheet open={isActionSheetOpen} onOpenChange={setIsActionSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[#0a0a0c]/60 backdrop-blur-3xl -z-10" />
            <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />
            
            <div className="flex flex-col h-full relative z-10">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                <SheetHeader className="mb-6 px-6 shrink-0">
                    <SheetTitle className="text-xl font-black text-center uppercase tracking-widest">Select Network to {actionType}</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6 pb-8">
                    <div className="grid grid-cols-1 gap-3 pb-12">
                        {allChains.map((chain) => (
                            <button 
                                key={chain.chainId}
                                onClick={() => {
                                    setSelectedNetworkForSelection(chain);
                                    setIsTokenSideSheetOpen(true);
                                }}
                                style={{
                                    borderColor: chain.themeColor || '#818cf8',
                                    borderWidth: '2px',
                                    background: `linear-gradient(135deg, ${chain.themeColor || '#818cf8'}25 0%, rgba(0,0,0,0) 100%)`,
                                }}
                                className="flex items-center justify-between p-3.5 rounded-2xl border transition-all group active:scale-[0.98] shadow-lg shadow-black/20"
                            >
                                <div className="flex items-center gap-4">
                                    <TokenLogoDynamic 
                                        logoUrl={chain.iconUrl} 
                                        alt={chain.name} 
                                        size={44} 
                                        chainId={chain.chainId} 
                                        name={chain.name} 
                                        symbol={chain.symbol}
                                    />
                                    <div className="text-left">
                                        <p className="font-bold text-base text-white">{chain.name}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono opacity-60">Chain ID: {chain.chainId}</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-[#0a0a0c]/95 backdrop-blur-2xl border-l border-primary/20 w-full sm:max-w-[400px] p-0 flex flex-col shadow-2xl">
            <SheetHeader className="p-6 border-b border-white/5 bg-gradient-to-b from-primary/10 to-transparent shrink-0">
                <SheetTitle className="flex items-center gap-2">
                    <TokenLogoDynamic 
                        logoUrl={selectedNetworkForSelection?.iconUrl} 
                        alt={selectedNetworkForSelection?.name || ''} 
                        size={32} 
                        chainId={selectedNetworkForSelection?.chainId} 
                        name={selectedNetworkForSelection?.name}
                        symbol={selectedNetworkForSelection?.symbol}
                    />
                    <div className="flex flex-col items-start text-left">
                        <span className="text-lg font-black uppercase tracking-tight">{selectedNetworkForSelection?.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Select Token to {actionType}</span>
                    </div>
                </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20 space-y-2 shadow-inner">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest">
                            <WalletIcon className="w-3.5 h-3.5" /> Your Address
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-mono break-all text-foreground/80 leading-relaxed">
                                {wallets && selectedNetworkForSelection ? getAddressForChain(selectedNetworkForSelection, wallets) : '...'}
                            </p>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-primary shrink-0 hover:bg-primary/20 rounded-xl" onClick={() => {
                                const addr = wallets && selectedNetworkForSelection ? getAddressForChain(selectedNetworkForSelection, wallets) : '';
                                if (addr) {
                                    navigator.clipboard.writeText(addr);
                                    toast({ title: "Address Copied" });
                                }
                            }}>
                                <Copy className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Available Assets</p>
                        <div className="space-y-2 pb-12">
                            {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                                const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                                return (
                                    <button 
                                        key={asset.symbol}
                                        onClick={() => handleTokenSelect(asset)}
                                        className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-[0.98] group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <TokenLogoDynamic 
                                                logoUrl={asset.iconUrl} 
                                                alt={asset.symbol} 
                                                size={44} 
                                                chainId={asset.chainId} 
                                                symbol={asset.symbol} 
                                                name={asset.name}
                                            />
                                            <div className="text-left leading-tight">
                                                <p className="font-bold text-base text-white group-hover:text-primary transition-colors">{asset.symbol}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{asset.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-sm font-bold text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-1">Available</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
