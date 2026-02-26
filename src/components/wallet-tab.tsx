
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  CheckCircle2,
  Timer
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
import QuickSwapPanel from './wallet/quick-swap-panel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getAddressForChain } from '@/lib/wallets/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';

// Utility to determine text contrast
const getContrastColor = (hex: string) => {
  if (!hex || hex.length < 7) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
};

const TokenRow = ({ token, isLoading }: { token: AssetRow, isLoading: boolean }) => {
  const router = useRouter();
  const isPositiveChange = (token.pctChange24h ?? 0) >= 0;
  const isFirstLoad = isLoading && (token.priceUsd === 0 || token.priceUsd === undefined);

  const handleRowClick = () => {
    router.push(`/token-details?symbol=${encodeURIComponent(token.symbol ?? '')}`);
  };

  return (
    <div
      onClick={handleRowClick}
      className="flex cursor-pointer items-center justify-between py-4 active:bg-white/5 transition-all w-full px-6"
      role="button"
    >
      <div className="flex items-center gap-3">
        <TokenLogoDynamic 
            alt={token.name} 
            logoUrl={token.iconUrl}
            symbol={token.symbol}
            name={token.name}
            size={38}
            chainId={token.chainId}
        />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-white tracking-tight">{token.symbol}</p>
            <p className="text-[10px] text-muted-foreground/60 font-medium">{token.name}</p>
          </div>
          <p
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider',
              isPositiveChange ? 'text-green-400' : 'text-red-400'
            )}
          >
            {isPositiveChange ? '▲' : '▼'} {(token.pctChange24h ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>
      <div className="text-right">
        {isFirstLoad ? (
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-5 w-24 rounded-lg bg-white/5" />
            <Skeleton className="h-3 w-16 rounded-lg bg-white/5" />
          </div>
        ) : (
          <>
            <p className="font-bold text-base text-white leading-none">
              {parseFloat(token.balance || '0').toLocaleString('en-US', {
                maximumFractionDigits: 6,
              })}{' '}
            </p>
            <p className="text-[10px] font-medium text-muted-foreground/60 mt-2 uppercase">
              ≈ ${(token.fiatValueUsd ?? 0).toLocaleString('en-US', {
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
  const { wallets, isInitialized, isWalletLoading, allAssets, isRefreshing, isTokenLoading, refresh, viewingNetwork, fetchError, infuraApiKey, allChains, balances, getAvailableAssetsForChain } = useWallet();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isTokenManagerOpen, setIsTokenManagerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [isApiKeySheetOpen, setIsApiKeySheetOpen] = useState(false);
  const [isQuickSwapOpen, setIsQuickSwapOpen] = useState(false);
  
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [actionType, setActionType] = useState<'send' | 'receive' | 'swap'>('send');
  const [selectedNetworkForSelection, setSelectedNetworkForSelection] = useState<ChainConfig | null>(null);
  const [isTokenSideSheetOpen, setIsTokenSideSheetOpen] = useState(false);

  const [fetchStartTime, setFetchStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  // API KEY PROMPT LOGIC: Only prompt if app initialization AND session restoration are truly complete
  useEffect(() => {
    // Increased safety window and strict state gating to prevent ghost prompt during cloud restore
    if (isInitialized && !isWalletLoading && !!wallets && !infuraApiKey) {
      const timer = setTimeout(() => {
        // Final sanity check: ensure we didn't just restore a key in the last 2 seconds
        const currentKey = localStorage.getItem('infura_api_key');
        if (!currentKey) {
            setIsApiKeySheetOpen(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    } else if (infuraApiKey) {
      setIsApiKeySheetOpen(false); // Force close if key appears via restore
    }
  }, [isInitialized, isWalletLoading, wallets, infuraApiKey]);

  useEffect(() => {
    if (isRefreshing) {
      setFetchStartTime(Date.now());
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => +(prev + 0.1).toFixed(1));
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setFetchStartTime(null);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRefreshing]);

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
    const val = Number.isFinite(balance) ? balance : 0;
    const s = val.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (s.length > 16) return 'text-xl';
    if (s.length > 12) return 'text-2xl';
    if (s.length > 9) return 'text-3xl';
    return 'text-4xl';
  };

  const openAction = (type: 'send' | 'receive' | 'swap') => {
    if (type === 'swap') {
        setIsQuickSwapOpen(true);
        return;
    }
    setActionType(type);
    setIsActionSheetOpen(true);
  };

  const handleTokenSelect = (token: AssetRow) => {
    setIsTokenSideSheetOpen(false);
    setIsActionSheetOpen(false);
    router.push(`/${actionType}?symbol=${token.symbol}&chainId=${token.chainId}`);
  };

  const ActionButton = ({ icon: Icon, label, onClick, disabled }: { icon: React.ElementType, label: string, onClick: () => void, disabled?: boolean }) => (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="default"
        size="icon"
        disabled={disabled}
        className={cn(
            "bg-primary hover:bg-primary/90 w-14 h-14 rounded-2xl shadow-lg transition-transform active:scale-90",
            disabled && "opacity-50 grayscale"
        )}
        onClick={onClick}
      >
        <Icon className="w-6 h-6 text-primary-foreground" />
      </Button>
      <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="bg-background pt-8">
        <div className="flex items-center justify-between px-6">
            <div className="relative group">
                <h2 className={cn(
                  'font-black tracking-tighter text-white transition-opacity',
                  getBalanceFontSize(Number(totalFiatValue ?? 0)),
                  isRefreshing && "opacity-80"
                )}>
                  US${(totalFiatValue || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h2>
                
                <div className="flex items-center gap-3 mt-1.5">
                  <p
                    className={cn(
                      'text-sm font-bold flex items-center gap-2',
                      total24hChange >= 0 ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {total24hChange >= 0 ? '+' : ''}$
                    {Math.abs(totalFiatValue - (totalFiatValue / (1 + total24hChange / 100 || 1))).toFixed(2)}
                    <span className="text-gray-500 font-medium text-xs">
                      ({total24hChange >= 0 ? '+' : ''}
                      {total24hChange.toFixed(2)}%)
                    </span>
                  </p>

                  {isRefreshing && (
                    <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-500">
                        <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-black text-green-500/80 uppercase tracking-widest flex items-center gap-1">
                            Updating... 
                            <span className="font-mono opacity-60">({elapsedSeconds}s)</span>
                        </span>
                    </div>
                  )}
                </div>
            </div>
        </div>

        <div className="flex justify-center gap-2.5 my-10 px-4">
          <ActionButton icon={ArrowUpFromLine} label="Send" onClick={() => openAction('send')} />
          <ActionButton icon={ArrowDownToLine} label="Receive" onClick={() => openAction('receive')} />
          <ActionButton icon={Repeat} label="Swap" onClick={() => openAction('swap')} />
          <ActionButton icon={Sparkles} label="Buy" onClick={() => router.push('/buy')} />
          <ActionButton icon={MoreHorizontal} label="More" onClick={() => setIsMoreActionsOpen(true)} />
        </div>
        
        <div className="w-full">
            <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 px-6 border-b border-white/5">
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
                    <Button
                        variant="ghost"
                        className="h-9 px-4 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 transition-all"
                        onClick={() => setIsTokenManagerOpen(true)}
                    >
                        <span className="font-black text-[10px] uppercase tracking-widest text-primary">Manage Assets</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-white/5 rounded-full hover:bg-white/10"
                        onClick={() => refresh()}
                        disabled={isRefreshing}
                    >
                      {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin text-primary"/> : <RefreshCw className="h-4 w-4 text-primary"/>}
                    </Button>
                </div>

                <div className="flex-1 pb-32">
                  {fetchError && (
                    <div 
                      className="mx-6 mb-4 p-4 rounded-xl bg-destructive/10 text-destructive text-xs flex items-center gap-3 border border-destructive/20 cursor-pointer"
                      onClick={() => setIsApiKeySheetOpen(true)}
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p className="font-medium">Connection limited. Check Infura key.</p>
                    </div>
                  )}

                  <div className="space-y-0">
                    {allAssets.map((token) => (
                      <TokenRow
                        key={`${token.chainId}-${token.address || token.symbol}`}
                        token={token}
                        isLoading={isTokenLoading(token.chainId, token.symbol) || isRefreshing}
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
      <QuickSwapPanel isOpen={isQuickSwapOpen} onOpenChange={setIsQuickSwapOpen} />

      <Sheet open={isActionSheetOpen} onOpenChange={setIsActionSheetOpen}>
        <SheetContent side="bottom" className="bg-transparent border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-3xl -z-10" />
            <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-black/80 -z-10" />
            
            <div className="flex flex-col flex-1 relative z-10 overflow-hidden">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                <SheetHeader className="mb-6 px-6 shrink-0 pt-4">
                    <SheetTitle className="text-xl font-black text-center uppercase tracking-widest">Select Network to {actionType}</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6">
                    <div className="grid grid-cols-2 gap-3 pb-24 pt-2">
                        {allChains.map((chain) => {
                            const themeColor = chain.themeColor || '#818cf8';
                            const textColor = getContrastColor(themeColor);
                            return (
                                <button 
                                    key={chain.chainId}
                                    onClick={() => {
                                        setSelectedNetworkForSelection(chain);
                                        setIsTokenSideSheetOpen(true);
                                    }}
                                    style={{
                                        borderColor: themeColor,
                                        borderWidth: '2px',
                                        background: `linear-gradient(135deg, ${themeColor} 0%, rgba(0,0,0,0.8) 100%)`,
                                    }}
                                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group"
                                >
                                    <TokenLogoDynamic 
                                        logoUrl={chain.iconUrl} 
                                        alt={chain.name} 
                                        size={40} 
                                        chainId={chain.chainId} 
                                        name={chain.name} 
                                        symbol={chain.symbol}
                                    />
                                    <p className="font-black text-[11px] uppercase tracking-tight line-clamp-1" style={{ color: textColor }}>{chain.name}</p>
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isTokenSideSheetOpen} onOpenChange={setIsTokenSideSheetOpen}>
        <SheetContent side="right" className="bg-[#0a0a0c]/95 backdrop-blur-2xl border-l border-primary/20 w-full sm:max-w-[450px] p-0 flex flex-col shadow-2xl">
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
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Select Token</span>
                    </div>
                </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
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
                                    toast({ title: "Copied" });
                                }
                            }}>
                                <Copy className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Available Assets</p>
                        <div className="space-y-2 pb-12">
                            {selectedNetworkForSelection && getAvailableAssetsForChain(selectedNetworkForSelection.chainId).map((token) => {
                                const asset = (balances[selectedNetworkForSelection.chainId]?.find(b => b.symbol === token.symbol) || { ...token, balance: '0' }) as AssetRow;
                                return (
                                    <button 
                                        key={asset.symbol}
                                        onClick={() => handleTokenSelect(asset)}
                                        className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left"
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
                                            <div>
                                                <p className="font-bold text-base text-white">{asset.symbol}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{asset.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-sm font-bold text-white">{parseFloat(asset.balance).toFixed(4)}</p>
                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-1">Balance</p>
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
