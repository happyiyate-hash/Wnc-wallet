'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import "chartjs-adapter-date-fns";
import type { AssetRow } from "@/lib/types";
import { useWallet } from "@/contexts/wallet-provider";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  GitFork,
  ArrowLeftRight,
  QrCode,
  DollarSign,
  Landmark,
  ArrowLeft,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketStats from "./market-stats";
import { useSingleTokenDetails } from "@/hooks/useTokenDetails";
import RechartsChart from "@/components/RechartsChart";
import { cn } from "@/lib/utils";
import Image from 'next/image';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import TransactionHistory from "./transaction-history";
import { useUser } from "@/contexts/user-provider";
import { Skeleton } from "@/components/ui/skeleton";
import GenericCoinIcon from "@/components/icons/GenericCoinIcon";

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
    className="flex flex-col items-center justify-center gap-1.5 text-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-foreground"
  >
    <div className="w-14 h-14 bg-primary/10 group-disabled:bg-zinc-800 group-disabled:hover:bg-zinc-800 hover:bg-primary/20 rounded-2xl flex items-center justify-center">
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
    <div className="flex items-center justify-between p-4">
        <Button onClick={onBack} variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
                <TokenLogoDynamic chainKey={token.chainId} address={token.address} symbol={token.symbol} name={token.name} size={24} alt={token.name} />
                <span className="font-semibold">{token.symbol}</span>
            </div>
            <span className="text-xs text-muted-foreground">{network?.name}</span>
        </div>
        <Button onClick={onInfo} variant="ghost" size="icon">
            <Info className="w-5 h-5" />
        </Button>
    </div>
);


export default function TokenDetailsClientPage() {
  const { allAssets, viewingNetwork, isInitialized } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenSymbol = searchParams.get('symbol');

  const [chartRange, setChartRange] = useState<
    "1D" | "1W" | "1M" | "3M" | "1Y" | "All"
  >("1D");
  
  const [priceChanged, setPriceChanged] = useState(false);
  const prevPriceRef = useRef<number | undefined | null>();

  const token = useMemo(() => {
    if (!tokenSymbol || !isInitialized) return null;
    return allAssets.find(a => a.symbol === tokenSymbol && a.chainId === viewingNetwork.chainId);
  }, [tokenSymbol, allAssets, viewingNetwork.chainId, isInitialized]);


  const coingeckoId = token?.coingeckoId;
  const { data: marketStats } = useSingleTokenDetails(coingeckoId);
  const isEvmChain = typeof token?.chainId === 'number' && token?.chainId > 0;

  useEffect(() => {
    if (prevPriceRef.current !== undefined && token?.priceUsd !== prevPriceRef.current) {
        setPriceChanged(true);
        const timer = setTimeout(() => setPriceChanged(false), 500);
        return () => clearTimeout(timer);
    }
    prevPriceRef.current = token?.priceUsd;
  }, [token?.priceUsd]);

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
  const displayPrice = price;


  const handleInfoClick = () => {
    if (token) {
      router.push(`/token-info?symbol=${token.symbol}`);
    }
  };

  const displayBalance = isNaN(balance) ? '0.00' : balance.toLocaleString('en-US', { maximumFractionDigits: 6 });
  const displayFiat = isNaN(fiatValue) ? '$0.00' : `$${fiatValue.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col h-screen bg-background">
      <TokenDetailHeader onBack={() => router.back()} onInfo={handleInfoClick} token={token} network={viewingNetwork} />
      <div className="flex-1 overflow-y-auto">
        <div className="text-center pt-4">
          <div className="flex items-center justify-center gap-2">
            <h2 className={`text-4xl font-bold transition-all duration-500 ${priceChanged ? 'animate-glow' : ''}`}>
              ${formatDisplayPrice(displayPrice)}
            </h2>
          </div>
          <div
            className={`mt-1 text-sm font-medium ${
              isNegativeChange ? "text-red-400" : "text-green-400"
            }`}
          >
            {priceChange24h !== null
              ? `${priceChange24h >= 0 ? "+" : ""}${priceChange24h.toFixed(2)}%`
              : "..."}
          </div>
        </div>

        <div className="h-96 relative">
          <RechartsChart coingeckoId={coingeckoId} days={chartRange} isNegative={isNegativeChange}/>
        </div>

        <div className="flex justify-between w-full mt-2 px-4">
          {(["1D", "1W", "1M", "3M", "1Y", "All"] as const).map((r) => (
            <Button
              key={r}
              onClick={() => setChartRange(r)}
              variant="ghost"
              size="sm"
              className={`text-xs transition-colors duration-300 px-3 rounded-md h-7 ${
                chartRange === r
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground"
              }`}
              disabled={!coingeckoId}
            >
              {r}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-around my-6 px-4">
            <ActionButton icon={<DollarSign className="w-7 h-7 text-primary" />} label="Buy" onClick={() => router.push('/buy')} />
            <ActionButton icon={<Landmark className="w-7 h-7 text-primary" />} label="Sell" onClick={() => router.push('/sell')} />
            <ActionButton icon={<ArrowLeftRight className="w-7 h-7 text-primary" />} label="Swap" onClick={() => router.push(`/swap?fromSymbol=${token.symbol}`)} />
            <ActionButton icon={<GitFork className="w-7 h-7 text-primary" />} label="Bridge" onClick={() => alert("Bridge sheet opened")} disabled={!isEvmChain} />
            <ActionButton icon={<ArrowUpRight className="w-7 h-7 text-primary" />} label="Send" onClick={() => router.push(`/send/details?chainId=${token.chainId}&tokenAddress=${token.address || 'native'}`)} />
            <ActionButton icon={<QrCode className="w-7 h-7 text-primary" />} label="Receive" onClick={() => alert("Receive sheet opened")} />
        </div>

        <div className="pb-4 px-4 space-y-6">
            <button
                onClick={handleInfoClick}
                className="flex items-center justify-between w-full text-left p-2 -mx-2 rounded-lg transition-colors hover:bg-muted/50"
            >
                <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                        <TokenLogoDynamic chainKey={token.chainId} address={token.address} symbol={token.symbol} name={token.name} size={40} alt={token.name} FallbackComponent={<GenericCoinIcon size={40}/>} />
                        {token.address !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' && viewingNetwork?.iconUrl && (
                          <Image src={viewingNetwork.iconUrl} alt={viewingNetwork.name} width={14} height={14} className="absolute -bottom-0.5 -right-0.5 rounded-full" unoptimized />
                        )}
                    </div>
                    <div>
                        <p className="font-semibold text-lg">{token.name}</p>
                        <p className="text-sm text-muted-foreground">
                        Balance
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-lg">
                        {displayBalance}{" "}
                        {token.symbol}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {displayFiat}
                    </p>
                </div>
            </button>
            
            <div className="pt-4">
                <MarketStats stats={marketStats} tokenSymbol={token.symbol} />
            </div>

            <div>
                <h3 className="text-lg font-bold mb-2">Recent Activity</h3>
                <TransactionHistory token={token} />
            </div>
        </div>
      </div>
    </div>
  );
}
