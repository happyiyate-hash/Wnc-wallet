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
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/wallet-provider';
import type { AssetRow } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import TokenManager from '@/components/wallet/tokens/token-manager';
import WalletManagementSheet from '@/components/wallet/wallet-management-sheet';
import NotificationCenter from '@/components/notifications/notification-center';
import { useUser } from '@/contexts/user-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TokenLogoDynamic from './shared/TokenLogoDynamic';
import MoreActionsSheet from './wallet/more-actions-sheet';
import ApiKeyRequestSheet from './wallet/api-key-request-sheet';
import { Skeleton } from './ui/skeleton';

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
  const { wallets, isInitialized, allAssets, isRefreshing, isTokenLoading, refresh, viewingNetwork, fetchError, infuraApiKey } = useWallet();
  const { user } = useUser();
  const [isTokenManagerOpen, setIsTokenManagerOpen] = useState(false);
  const [isWalletSheetOpen, setIsWalletSheetOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [isApiKeySheetOpen, setIsApiKeySheetOpen] = useState(false);
  const router = useRouter();

  // Handle wallet onboarding
  useEffect(() => {
    if (isInitialized && !wallets) {
      setIsWalletSheetOpen(true);
    }
  }, [isInitialized, wallets]);

  // Proactively request API key if missing but wallet exists
  useEffect(() => {
    if (isInitialized && !!wallets && !infuraApiKey) {
      // Small delay to let the initial UI breathe
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

  const ActionButton = ({ icon: Icon, label, href, onClick }: { icon: React.ElementType, label: string, href?: string, onClick?: () => void }) => (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="default"
        size="icon"
        className="bg-primary hover:bg-primary/90 w-14 h-14 rounded-2xl"
        onClick={() => {
            if (href) router.push(href);
            if (onClick) onClick();
        }}
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
          <ActionButton icon={ArrowUpFromLine} label="Send" href="/send" />
          <ActionButton icon={ArrowDownToLine} label="Receive" href="/receive" />
          <ActionButton icon={Repeat} label="Swap" href="/swap" />
          <ActionButton icon={Sparkles} label="Buy" href="/buy" />
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
      <WalletManagementSheet isOpen={isWalletSheetOpen} onOpenChange={setIsWalletSheetOpen} />
      <ApiKeyRequestSheet isOpen={isApiKeySheetOpen} onOpenChange={setIsApiKeySheetOpen} />
      {user && <NotificationCenter isOpen={isNotificationsOpen} onOpenChange={setIsNotificationsOpen} userId={user.id}/>}
      <MoreActionsSheet isOpen={isMoreActionsOpen} onOpenChange={setIsMoreActionsOpen} />
    </div>
  );
}

