
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
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';

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
  const { wallets, isInitialized, isWalletLoading, allAssets, isRefreshing, refresh, viewingNetwork, fetchError, infuraApiKey } = useWallet();
  const { user } = useUser();
  
  const [isTokenManagerOpen, setIsTokenManagerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [isApiKeySheetOpen, setIsApiKeySheetOpen] = useState(false);
  const [isQuickSwapOpen, setIsQuickSwapOpen] = useState(false);
  
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !isWalletLoading && !!wallets && !infuraApiKey) {
      const timer = setTimeout(() => {
        const currentKey = localStorage.getItem('infura_api_key');
        if (!currentKey) {
            setIsApiKeySheetOpen(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    } else if (infuraApiKey) {
      setIsApiKeySheetOpen(false);
    }
  }, [isInitialized, isWalletLoading, wallets, infuraApiKey]);

  useEffect(() => {
    if (isRefreshing) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => +(prev + 0.1).toFixed(1));
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
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
    // DIRECT NAVIGATION as requested: Defaults are handled by the destination page context logic
    router.push(`/${type}`);
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
                        isLoading={isRefreshing}
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
    </div>
  );
}
