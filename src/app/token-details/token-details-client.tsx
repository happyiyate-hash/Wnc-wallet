'use client';

import React, { useEffect, useState, useRef, useMemo } from "react";
import "chartjs-adapter-date-fns";
import type { AssetRow } from "@/lib/types";
import { useWallet } from "@/contexts/wallet-provider";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  ArrowLeftRight,
  QrCode,
  DollarSign,
  ArrowLeft,
  Info
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

const formatDisplayPrice = (price: number) => {
  if (price === 0) return "0.00";
  if (price < 1.0) {
    const priceStr = price.toPrecision(4);
    if (priceStr.includes('e-')) return priceStr;
    return parseFloat(priceStr).toString();
  }
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

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
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{network?.name}</span>
        </div>
        <Button onClick={onInfo} variant="ghost" size="icon" className="rounded-xl">
            <Info className="w-5 h-5" />
        </Button>
    </div>
);


export default function TokenDetailsClientPage() {
  const { allAssets, viewingNetwork, isInitialized } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenSymbol = searchParams.get('symbol');

  const [chartRange, setChartRange] = useState<"1D" | "1W" | "1M" | "3M" | "1Y" | "All">("1D");

  const token = useMemo(() => {
    if (!tokenSymbol || !isInitialized) return null;
    return allAssets.find(a => a.symbol === tokenSymbol && a.chainId === viewingNetwork.chainId);
  }, [tokenSymbol, allAssets, viewingNetwork.chainId, isInitialized]);

  const coingeckoId = token?.coingeckoId;
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
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-4xl font-black tracking-tight text-white">
              ${formatDisplayPrice(price)}
            </h2>
          </div>
          <div className={cn("mt-1 text-sm font-bold", isNegativeChange ? "text-red-400" : "text-green-400")}>
            {priceChange24h !== null ? `${priceChange24h >= 0 ? "+" : ""}${priceChange24h.toFixed(2)}%` : "..."}
          </div>
        </div>

        {/* FULL BLEED CHART - NO HORIZONTAL PADDING */}
        <div className="h-64 relative w-full overflow-hidden">
          <RechartsChart coingeckoId={coingeckoId} days={chartRange} isNegative={isNegativeChange}/>
        </div>

        <div className="flex justify-between w-full mt-2 px-6">
          {(["1D", "1W", "1M", "3M", "1Y", "All"] as const).map((r) => (
            <Button
              key={r}
              onClick={() => setChartRange(r)}
              variant="ghost"
              size="sm"
              className={cn("text-[10px] font-black h-7 rounded-lg", chartRange === r ? "bg-primary/20 text-primary" : "text-muted-foreground")}
              disabled={!coingeckoId}
            >
              {r}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-around my-10 px-4">
            <ActionButton icon={<DollarSign className="w-6 h-6 text-primary" />} label="Buy" onClick={() => handleAction('/buy')} />
            <ActionButton icon={<ArrowLeftRight className="w-6 h-6 text-primary" />} label="Swap" onClick={() => handleAction('/swap')} />
            {/* Bridge Button Removed as Requested */}
            <ActionButton icon={<ArrowUpRight className="w-6 h-6 text-primary" />} label="Send" onClick={() => handleAction('/send')} />
            <ActionButton icon={<QrCode className="w-6 h-6 text-primary" />} label="Receive" onClick={() => handleAction('/receive')} />
        </div>
        
        <div className="px-6 pb-12 space-y-8">
            <div className="flex items-center justify-between w-full p-4 rounded-2xl bg-secondary/30 border border-white/5">
                <div className="flex items-center gap-3">
                    <TokenLogoDynamic 
                      logoUrl={token.iconUrl} 
                      size={40} 
                      alt={token.name} 
                      chainId={token.chainId} 
                      name={token.name} 
                      symbol={token.symbol}
                    />
                    <div>
                        <p className="font-bold text-base text-white">{token.symbol} Balance</p>
                        <p className="text-xs text-muted-foreground">{viewingNetwork.name}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg text-white">{balance.toLocaleString('en-US', { maximumFractionDigits: 6 })}</p>
                    <p className="text-xs text-muted-foreground">≈ ${fiatValue.toLocaleString("en", { minimumFractionDigits: 2 })}</p>
                </div>
            </div>
            
            <MarketStats stats={marketStats} tokenSymbol={token.symbol} />
            
            <div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-4">Activity</h3>
                <TransactionHistory token={token} />
            </div>
        </div>
      </div>
    </div>
  );
}
