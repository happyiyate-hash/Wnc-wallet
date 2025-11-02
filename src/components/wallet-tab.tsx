'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Plus,
  ArrowUpFromLine,
  ArrowDownToLine,
  Wallet,
  Loader2,
  Repeat,
  Sparkles,
  MoreHorizontal
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
import CachedImage from '@/components/CachedImage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TokenLogoDynamic from './shared/TokenLogoDynamic';
import ApiKeyManager from './wallet/api-key-manager';
import MoreActionsSheet from './wallet/more-actions-sheet';

const TokenRow = ({ token }: { token: AssetRow }) => {
  const router = useRouter();
  const isPositiveChange = (token.pctChange24h ?? 0) >= 0;

  const handleRowClick = () => {
    router.push(`/token-details?symbol=${encodeURIComponent(token.symbol ?? '')}`);
  };

  return (
    <div
      className="flex cursor-pointer items-center justify-between p-3"
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-3">
        <TokenLogoDynamic 
            alt={token.name} 
            logoUrl={token.iconUrl}
            size={28}
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
      </div>
    </div>
  );
};

export default function WalletTab() {
  const { wallets, isInitialized, viewingNetwork, allAssets, isRefreshing, refresh, infuraApiKey } = useWallet();
  const { user } = useUser();
  const [isTokenManagerOpen, setIsTokenManagerOpen] = useState(false);
  const [isWalletSheetOpen, setIsWalletSheetOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isApiManagerOpen, setIsApiManagerOpen] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const router = useRouter();

  const assets = useMemo(() => {
    return allAssets.filter(asset => asset.chainId === viewingNetwork.chainId);
  }, [allAssets, viewingNetwork.chainId]);
  
  useEffect(() => {
    if (isInitialized) {
        if (!wallets) {
          setIsWalletSheetOpen(true);
        } else if (!infuraApiKey) {
          setIsApiManagerOpen(true);
        }
    }
  }, [isInitialized, wallets, infuraApiKey]);
  
  const totalFiatValue = useMemo(() => {
    return assets.reduce((sum, asset) => sum + (asset.fiatValueUsd ?? 0), 0);
  }, [assets]);
  
  const total24hChange = useMemo(() => {
    if (!assets || assets.length === 0 || totalFiatValue === 0) return 0;
    
    let totalValueYesterday = 0;
    for (const asset of assets) {
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
  }, [assets, totalFiatValue]);

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

  if (!wallets && isInitialized) {
    return (
      <>
        <div className="flex h-full flex-col items-center justify-center text-center p-4 mt-6">
          <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold">Welcome to Your Wallet</h2>
          <p className="text-muted-foreground mt-2 mb-6">
            Create or import a wallet to get started.
          </p>
          <Button size="lg" onClick={() => setIsWalletSheetOpen(true)}>
            Get Started
          </Button>
        </div>
        <WalletManagementSheet
          isOpen={isWalletSheetOpen}
          onOpenChange={setIsWalletSheetOpen}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-background pt-8">
        {/* Balance */}
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
                {(
                  totalFiatValue -
                  (totalFiatValue / (1 + total24hChange / 100 || 1))
                ).toFixed(2)}
                <span className="text-gray-400 ml-2">
                  ({total24hChange >= 0 ? '+' : ''}
                  {total24hChange.toFixed(2)}%)
                </span>
              </p>
            </div>
        </div>

        {/* Actions */}
        <div className="flex justify-around my-8">
          <ActionButton icon={ArrowUpFromLine} label="Send" href="/send" />
          <ActionButton icon={ArrowDownToLine} label="Receive" href="/receive" />
          <ActionButton icon={Repeat} label="Swap" href="/swap" />
          <ActionButton icon={Sparkles} label="Buy" href="/buy" />
          <ActionButton icon={MoreHorizontal} label="More" onClick={() => setIsMoreActionsOpen(true)} />
        </div>
        
        {/* Tabs */}
        <div className="w-full px-4">
            <Tabs defaultValue="tokens" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-transparent p-0">
                <TabsTrigger
                  value="tokens"
                  className="p-0 pb-2 data-[state=active]:text-foreground data-[state=active]:font-bold data-[state=active]:bg-transparent rounded-none flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary"
                >
                  Tokens
                </TabsTrigger>
                <TabsTrigger
                  value="defi"
                  disabled
                  className="p-0 pb-2 text-muted-foreground/50 flex-1"
                >
                  DeFi
                </TabsTrigger>
                <TabsTrigger
                  value="nfts"
                  disabled
                  className="p-0 pb-2 text-muted-foreground/50 flex-1"
                >
                  NFTs
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tokens">
                 {/* Manage Section */}
                <div className="flex items-center justify-between py-4">
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
                        <div className="p-[1px] bg-gradient-to-r from-blue-500/50 to-green-500/50 rounded-full">
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
                         <div className="p-[1px] bg-gradient-to-r from-blue-500/50 to-green-500/50 rounded-full">
                            <Button
                            size="icon"
                            className="h-9 w-9 rounded-full bg-background hover:bg-muted/50"
                            onClick={() => router.push('/tokens/add')}
                            >
                            <Plus className="h-5 w-5 text-primary" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-y-auto">
                  {isRefreshing && assets.length === 0 ? (
                     <div className="flex items-center justify-center pt-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                     </div>
                  ) : assets.length > 0 ? (
                    <div>
                        {assets.map((token) => (
                        <TokenRow
                            key={`${token.chainId}-${token.address || token.symbol}`}
                            token={token}
                        />
                        ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center pt-10">
                        <div className="text-center text-muted-foreground">
                          No tokens to show.
                        </div>
                    </div>
                  )}
                </div>
              </TabsContent>
               <TabsContent value="defi">
                    <div className="text-center text-muted-foreground p-8">
                        DeFi features are coming soon!
                    </div>
                </TabsContent>
                <TabsContent value="nfts">
                    <div className="text-center text-muted-foreground p-8">
                        NFTs are coming soon!
                    </div>
                </TabsContent>
            </Tabs>
        </div>
      </div>

      {/* Sheets */}
      <TokenManager isOpen={isTokenManagerOpen} onOpenChange={setIsTokenManagerOpen} />
      <WalletManagementSheet isOpen={isWalletSheetOpen} onOpenChange={setIsWalletSheetOpen} />
      {user && <NotificationCenter isOpen={isNotificationsOpen} onOpenChange={setIsNotificationsOpen} userId={user.id}/>}
      <ApiKeyManager isOpen={isApiManagerOpen} onOpenChange={setIsApiManagerOpen} />
      <MoreActionsSheet isOpen={isMoreActionsOpen} onOpenChange={setIsMoreActionsOpen} />
    </div>
  );
}
