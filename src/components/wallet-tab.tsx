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
  Copy
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

const TokenRow = ({ token, isLoading }: { token: AssetRow, isLoading: boolean }) => {
  const router = useRouter();
  const isPositiveChange = (token.pctChange24h ?? 0) >= 0;

  const handleRowClick = () => {
    router.push(`/token-details?symbol=${encodeURIComponent(token.symbol ?? '')}`);
  };

  return (
    <div
      className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-3">
        <TokenLogoDynamic 
            alt={token.name} 
            logoUrl={token.iconUrl}
            symbol={token.symbol}
            name={token.name}
            size={36}
            chainId={token.chainId}
        />
        <div>
          <p className="font-semibold text-sm">{token.name}</p>
          <p
            className={cn(
              'text-xs',
              isPositiveChange ? 'text-green-500' : 'text-red-400'
            )}
          >
            {isPositiveChange ? '+' : ''}
            {(token.pctChange24h ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>
      <div className="text-right">
        {isLoading ? (
          <div className="space-y-1">
            <Loader2 className="h-3 w-3 animate-spin ml-auto text-primary" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        ) : (
          <>
            <p className="font-semibold text-sm">
              {parseFloat(token.balance || '0').toLocaleString('en-US', {
                maximumFractionDigits: 6,
              })}{' '}
              {token.symbol}
            </p>
            <p className="text-xs text-muted-foreground">
              $
              {(token.fiatValueUsd ?? 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default function WalletTab() {
  const { wallets, isInitialized, allAssets, isRefreshing, isTokenLoading, refresh, viewingNetwork, fetchError, infuraApiKey, allChains, balances } = useWallet();
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
        className="bg-primary hover:bg-primary/90 w-14 h-14 rounded-2xl"
        onClick={onClick}
      >
        <Icon className="w-6 h-6 text-primary-foreground" />
      </Button>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="bg-background pt-8">
        <div className="flex items-center justify-between px-4">
            <div>
              <h2 className={cn(
                'font-bold',
                getBalanceFontSize(Number(totalFiatValue ?? 0))
              )}>
                US$
                {(totalFiatValue || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h2>
              <p
                className={cn(
                  'text-sm mt-1',
                  total24hChange >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {total24hChange >= 0 ? '+' : ''}$
                {Math.abs(totalFiatValue - (totalFiatValue / (1 + total24hChange / 100 || 1))).toFixed(2)}
                <span className="text-gray-400 ml-2">
                  ({total24hChange >= 0 ? '+' : ''}
                  {total24hChange.toFixed(2)}%)
                </span>
              </p>
            </div>
        </div>

        <div className="flex justify-center gap-4 my-8">
          <ActionButton icon={ArrowUpFromLine} label="Send" onClick={() => openAction('send')} />
          <ActionButton icon={ArrowDownToLine} label="Receive" onClick={() => openAction('receive')} />
          <ActionButton icon={Repeat} label="Swap" onClick={() => openAction('swap')} />
          <ActionButton icon={Sparkles} label="Buy" onClick={() => router.push('/buy')} />
          <ActionButton icon={MoreHorizontal} label="More" onClick={() => setIsMoreActionsOpen(true)} />
        </div>
        
        <div className="w-full">
            <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 px-4">
                <TabsTrigger
                  value="tokens"
                  className="p-0 pb-2 data-[state=active]:text-foreground data-[state=active]:font-bold data-[state=active]:bg-transparent rounded-none flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary"
                >
                  Tokens
                </TabsTrigger>
                <TabsTrigger value="defi" disabled className="p-0 pb-2 text-muted-foreground/50 flex-1">DeFi</TabsTrigger>
                <TabsTrigger value="nfts" disabled className="p-0 pb-2 text-muted-foreground/50 flex-1">NFTs</TabsTrigger>
              </TabsList>
              <TabsContent value="tokens" className="px-0">
                <div className="flex items-center justify-between py-4 px-4">
                    <div className="p-[1px] bg-gradient-to-r from-blue-500/50 to-green-500/50 rounded-full">
                        <Button
                            variant="outline"
                            className="h-10 px-4 bg-background hover:bg-muted/50 rounded-full border-none"
                            onClick={() => setIsTokenManagerOpen(true)}
                        >
                            <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent font-semibold">Manage Tokens</span>
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 bg-background rounded-full hover:bg-background/80"
                            onClick={() => refresh()}
                            disabled={isRefreshing}
                        >
                          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin text-purple-400"/> : <RefreshCw className="h-4 w-4 text-purple-400"/>}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto thin-scrollbar">
                  {fetchError && (
                    <div 
                      className="mx-4 mb-4 p-4 rounded-2xl bg-destructive/10 text-destructive text-xs flex items-center gap-3 border border-destructive/20 cursor-pointer active:scale-[0.98] transition-all"
                      onClick={() => setIsApiKeySheetOpen(true)}
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold mb-0.5">Connection Error</p>
                        <p className="opacity-80">Tap here to fix your Infura API Key and see live balances.</p>
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-white/5">
                    {allAssets.map((token) => (
                      <TokenRow
                        key={`${token.chainId}-${token.address || token.symbol}`}
                        token={token}
                        isLoading={isTokenLoading(token.chainId, token.symbol)}
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
        <SheetContent side="bottom" className="bg-zinc-950 border-white/10 rounded-t-[3rem] p-6 max-h-[80vh] overflow-y-auto thin-scrollbar">
            <SheetHeader className="mb-6">
                <SheetTitle className="text-xl font-bold text-center capitalize">Select Network to {actionType}</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-1 gap-3">
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
                        className="flex items-center justify-between p-5 rounded-2xl border transition-all group active:scale-[0.98] shadow-lg shadow-black/20"
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
        </SheetContent>
      </Sheet>

      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-zinc-950 border-white/10 w-full sm:max-w-[400px] p-0 flex flex-col">
            <SheetHeader className="p-6 border-b border-white/5">
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
                        <span className="text-lg font-bold">{selectedNetworkForSelection?.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Select Token to {actionType}</span>
                    </div>
                </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-6">
                <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
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
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-2">Available Assets</p>
                    <div className="space-y-2">
                        {selectedNetworkForSelection && getInitialAssets(selectedNetworkForSelection.chainId).map((token) => {
                            const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                            return (
                                <button 
                                    key={asset.symbol}
                                    onClick={() => handleTokenSelect(asset)}
                                    className="w-full flex items-center justify-between p-5 rounded-[1.5rem] bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-[0.98] group"
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
        </SheetContent>
      </Sheet>
    </div>
  );
}
