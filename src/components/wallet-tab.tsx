
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw,
  ArrowUpFromLine,
  ArrowDownToLine,
  Loader2,
  Repeat,
  ChevronDown,
  Timer,
  HandCoins,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/wallet-provider';
import { useMarket } from '@/contexts/market-provider';
import type { AssetRow } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import TokenManager from '@/components/wallet/tokens/token-manager';
import { useCurrency } from '@/contexts/currency-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TokenLogoDynamic from './shared/TokenLogoDynamic';
import ApiKeyRequestSheet from './wallet/api-key-request-sheet';
import QuickSwapPanel from './wallet/quick-swap-panel';
import { motion, animate } from 'framer-motion';

const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const { formatFiat } = useCurrency();

  useEffect(() => {
    const controls = animate(displayValue, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplayValue(latest),
    });
    return () => controls.stop();
  }, [value, displayValue]);

  return (
    <span>
      {formatFiat(displayValue)}
    </span>
  );
};

// ATOMIC MEMOIZED ROW
const TokenRow = React.memo(({ token }: { token: AssetRow }) => {
  const router = useRouter();
  const { formatFiat } = useCurrency();
  const isPositiveChange = (token.pctChange24h ?? 0) >= 0;

  const handleRowClick = () => {
    router.push(`/token-details?symbol=${encodeURIComponent(token.symbol ?? '')}&chainId=${token.chainId}`);
  };

  return (
    <div
      onClick={handleRowClick}
      className="flex cursor-pointer items-center justify-between py-4 active:bg-white/5 transition-all w-full px-6 group"
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
        <p className="font-bold text-base text-white leading-none">
          {parseFloat(token.balance || '0').toLocaleString('en-US', {
            maximumFractionDigits: 6,
          })}{' '}
        </p>
        <p className="text-[10px] font-medium text-muted-foreground/60 mt-2 uppercase">
          ≈ {formatFiat(token.fiatValueUsd ?? 0)}
        </p>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.token.balance === next.token.balance && 
         prev.token.priceUsd === next.token.priceUsd &&
         prev.token.pctChange24h === next.token.pctChange24h;
});

TokenRow.displayName = 'TokenRow';

export default function WalletTab({ computedAssets }: { computedAssets: AssetRow[] }) {
  const { isRefreshing, refresh, infuraApiKey, setIsRequestOverlayOpen } = useWallet();
  const { formatFiat, convertFromUsd } = useCurrency();
  
  const [isTokenManagerOpen, setIsTokenManagerOpen] = useState(false);
  const [isApiKeySheetOpen, setIsApiKeySheetOpen] = useState(false);
  const [isQuickSwapOpen, setIsQuickSwapOpen] = useState(false);
  
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();

  useEffect(() => { setHasMounted(true); }, []);

  const { totalFiatValue, total24hChange } = useMemo(() => {
    const totalValue = computedAssets.reduce((sum, asset) => sum + (asset.fiatValueUsd ?? 0), 0);
    let totalValueYesterday = 0;
    
    for (const asset of computedAssets) {
      const price = asset.priceUsd ?? 0;
      const change = asset.pctChange24h ?? 0;
      const balance = parseFloat(asset.balance || '0') || 0;
      if (!price || !balance) continue;
      // Reverse percentage to get yesterday's USD price
      const denom = 1 + change / 100;
      if (denom === 0) continue;
      const priceYesterday = price / denom;
      totalValueYesterday += priceYesterday * balance;
    }
    
    const delta = totalValueYesterday === 0 ? 0 : ((totalValue - totalValueYesterday) / totalValueYesterday) * 100;
    return { totalFiatValue: totalValue, total24hChange: delta };
  }, [computedAssets]);

  const openAction = (type: string) => {
    if (type === 'swap') { setIsQuickSwapOpen(true); return; }
    if (type === 'request') { setIsRequestOverlayOpen(true); return; }
    router.push(`/${type}`);
  };

  if (!hasMounted) return <div className="flex-1 bg-transparent" />;

  const changeAbsolute = Math.abs(totalFiatValue - (totalFiatValue / (1 + total24hChange / 100 || 1)));

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="pt-8">
        <div className="flex items-center justify-between px-6">
            <div className="relative group">
                <h2 className="font-black tracking-tighter text-white text-4xl">
                  <AnimatedNumber value={totalFiatValue || 0} />
                </h2>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className={cn('text-sm font-bold flex items-center gap-2', total24hChange >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {total24hChange >= 0 ? '+' : '-'}{formatFiat(changeAbsolute)}
                    <span className="text-gray-500 font-medium text-xs">({total24hChange.toFixed(2)}%)</span>
                  </div>
                  {isRefreshing && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                </div>
            </div>
        </div>

        <div className="flex justify-center gap-2.5 my-10 px-4">
          <Button size="icon" className="w-14 h-14 rounded-2xl bg-primary shadow-lg" onClick={() => openAction('send')}><ArrowUpFromLine /></Button>
          <Button size="icon" className="w-14 h-14 rounded-2xl bg-primary shadow-lg" onClick={() => openAction('receive')}><ArrowDownToLine /></Button>
          <Button size="icon" className="w-14 h-14 rounded-2xl bg-primary shadow-lg" onClick={() => openAction('swap')}><Repeat /></Button>
          <Button size="icon" className="w-14 h-14 rounded-2xl bg-primary shadow-lg" onClick={() => openAction('request')}><HandCoins /></Button>
          <Button size="icon" className="w-14 h-14 rounded-2xl bg-primary shadow-lg" onClick={() => openAction('my-requests')}><History /></Button>
        </div>

        <Tabs defaultValue="tokens" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-transparent px-6 border-b border-white/5">
            <TabsTrigger value="tokens" className="pb-3 text-xs font-black uppercase tracking-widest data-[state=active]:border-b-4 data-[state=active]:border-primary">Tokens</TabsTrigger>
            <TabsTrigger value="defi" disabled className="pb-3 text-[10px] opacity-20">DeFi</TabsTrigger>
            <TabsTrigger value="nfts" disabled className="pb-3 text-[10px] opacity-20">NFTs</TabsTrigger>
          </TabsList>
          <TabsContent value="tokens" className="pt-2">
            <div className="flex items-center justify-between py-6 px-6">
                <Button variant="ghost" className="h-9 px-4 bg-white/5 rounded-full" onClick={() => setIsTokenManagerOpen(true)}>Manage Assets <ChevronDown className="ml-2 w-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => refresh()} disabled={isRefreshing}>{isRefreshing ? <Loader2 className="animate-spin text-primary" /> : <RefreshCw className="text-primary" />}</Button>
            </div>
            <div className="pb-32">
              {computedAssets.map((token) => (
                <TokenRow key={`${token.chainId}-${token.address || token.symbol}`} token={token} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <TokenManager isOpen={isTokenManagerOpen} onOpenChange={setIsTokenManagerOpen} />
      <ApiKeyRequestSheet isOpen={isApiKeySheetOpen} onOpenChange={setIsApiKeySheetOpen} />
      <QuickSwapPanel isOpen={isQuickSwapOpen} onOpenChange={setIsQuickSwapOpen} />
    </div>
  );
}
