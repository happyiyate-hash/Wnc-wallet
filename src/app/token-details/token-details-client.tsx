
'use client';

import React, { useEffect, useState, useRef, useMemo } from "react";
import "chartjs-adapter-date-fns";
import type { AssetRow } from "@/lib/types";
import { useWallet } from "@/contexts/wallet-provider";
import { useCurrency } from "@/contexts/currency-provider";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  ArrowLeftRight,
  QrCode,
  DollarSign,
  ArrowLeft,
  Info,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketStats from "./market-stats";
import { useSingleTokenDetails } from "@/hooks/useTokenDetails";
import RechartsChart from "@/components/RechartsChart";
import { cn } from "@/lib/utils";
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import TransactionHistory from "./transaction-history";
import { Skeleton } from "@/components/ui/skeleton";

const ActionButton = ({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center justify-center gap-1.5 text-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
  >
    <div className="w-14 h-14 bg-primary/10 group-disabled:bg-zinc-800 hover:bg-primary/20 rounded-2xl flex items-center justify-center transition-colors">
      {icon}
    </div>
    <span className="text-xs font-medium">{label}</span>
  </button>
);

const TokenDetailHeader = ({ onBack, onInfo, token, network }: { onBack: () => void, onInfo: () => void, token: AssetRow, network: any }) => (
    <div className="flex items-center justify-between p-4 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <Button onClick={onBack} variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
                <TokenLogoDynamic 
                    logoUrl={token.iconUrl} 
                    alt={token.name} 
                    size={24} 
                    chainId={token.chainId} 
                    name={token.name}
                    symbol={token.symbol}
                />
                <span className="font-semibold">{token.symbol}</span>
            </div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{token.symbol === 'WNC' ? 'Internal Cloud Node' : network?.name}</span>
        </div>
        <Button onClick={onInfo} variant="ghost" size="icon" className="rounded-xl">
            <Info className="w-5 h-5" />
        </Button>
    </div>
);


export default function TokenDetailsClientPage() {
  const { allAssets, viewingNetwork, isInitialized, prices } = useWallet();
  const { formatFiat, selectedCurrency } = useCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenSymbol = searchParams.get('symbol');

  const [chartRange, setChartRange] = useState<"1D" | "1W" | "1M" | "3M" | "1Y" | "All">("1D");

  // Dynamically find the token in allAssets. 
  const token = useMemo(() => {
    if (!tokenSymbol || !isInitialized) return null;
    return allAssets.find(a => a.symbol === tokenSymbol);
  }, [tokenSymbol, allAssets, isInitialized]);

  const coingeckoId = token?.symbol === 'WNC' ? 'internal:wnc' : token?.coingeckoId;
  const { data: marketStats } = useSingleTokenDetails(coingeckoId);

  if (!token) {
     return (
        <div className="flex flex-col h-screen">
            <div className="p-4"><Skeleton className="w-8 h-8 rounded-full" /></div>
            <div className="flex-1 flex items-center justify-center">
                <p>Token not found.</p>
            </div>
        </div>
     );
  }

  const price = token?.priceUsd ?? 0;
  // Pull live percentage trend from WalletProvider
  const priceChange24h = token?.pctChange24h ?? 0;
  const isNegativeChange = priceChange24h < 0;
  const balance = Number(token.balance || '0');
  const fiatValue = token.fiatValueUsd ?? (price * balance);

  const handleAction = (path: string) => {
    router.push(`${path}?symbol=${token.symbol}&chainId=${token.chainId}`);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <TokenDetailHeader onBack={() => router.back()} onInfo={() => {}} token={token} network={viewingNetwork} />
      <div className="flex-1 overflow-y-auto thin-scrollbar">
        <div className="text-center pt-8 pb-4">
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Market Evaluation ({selectedCurrency})</p>
            <h2 className="text-5xl font-black tracking-tighter text-white transition-all duration-500">
              {formatFiat(price)}
            </h2>
          </div>
          <div className={cn("mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-500", isNegativeChange ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400")}>
            {isNegativeChange ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
            {priceChange24h !== null ? `${priceChange24h >= 0 ? "+" : ""}${priceChange24h.toFixed(2)}%` : "..."}
          </div>
        </div>

        {/* FULL BLEED CHART */}
        <div className="h-64 relative w-full overflow-hidden mt-4">
          <RechartsChart coingeckoId={coingeckoId} days={chartRange} isNegative={isNegativeChange}/>
        </div>

        <div className="flex justify-between w-full mt-4 px-6">
          {(["1D", "1W", "1M", "3M", "1Y", "All"] as const).map((r) => (
            <Button
              key={r}
              onClick={() => setChartRange(r)}
              variant="ghost"
              size="sm"
              className={cn("text-[10px] font-black h-8 px-3 rounded-xl transition-all", chartRange === r ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-white/5")}
              disabled={!coingeckoId}
            >
              {r}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-around my-10 px-4">
            <ActionButton icon={<DollarSign className="w-6 h-6 text-primary" />} label="Buy" onClick={() => handleAction('/buy')} />
            <ActionButton icon={<ArrowLeftRight className="w-6 h-6 text-primary" />} label="Swap" onClick={() => handleAction('/swap')} />
            <ActionButton icon={<ArrowUpRight className="w-6 h-6 text-primary" />} label="Send" onClick={() => handleAction('/send')} />
            <ActionButton icon={<QrCode className="w-6 h-6 text-primary" />} label="Receive" onClick={() => handleAction('/receive')} />
        </div>
        
        <div className="px-6 pb-12 space-y-8">
            <div className="flex items-center justify-between w-full p-5 rounded-[2rem] bg-white/[0.03] border border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-4 relative z-10">
                    <TokenLogoDynamic 
                      logoUrl={token.iconUrl} 
                      size={44} 
                      alt={token.name} 
                      chainId={token.chainId} 
                      name={token.name} 
                      symbol={token.symbol}
                    />
                    <div>
                        <p className="font-black text-sm text-white tracking-tight">{token.symbol} Balance</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{token.symbol === 'WNC' ? 'SmarterSeller Registry' : viewingNetwork.name}</p>
                    </div>
                </div>
                <div className="text-right relative z-10">
                    <p className="font-black text-lg text-white">{balance.toLocaleString('en-US', { maximumFractionDigits: 6 })}</p>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">≈ {formatFiat(fiatValue)}</p>
                </div>
            </div>
            
            <MarketStats stats={marketStats} tokenSymbol={token.symbol} />
            
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Activity Log</h3>
                    <div className="h-px flex-1 bg-white/5" />
                </div>
                <TransactionHistory token={token} />
            </div>
        </div>
      </div>
    </div>
  );
}
