'use client';
import React, { memo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchChartData } from '@/lib/coingecko';
import { Skeleton } from './ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';

interface RechartsChartProps {
    coingeckoId?: string | null;
    days: string;
    isNegative: boolean;
    chainId?: number;
    contractAddress?: string;
}

/**
 * RECHART TERMINAL COMPONENT
 * Wrapped in memo to prevent high-frequency re-renders from the live price ticker.
 */
const RechartsChart = memo(({ coingeckoId, days, isNegative, chainId, contractAddress }: RechartsChartProps) => {
    // We only access these to get initial values, not as reactive dependencies for the graph path
    const { prices, allAssets } = useWallet();
    const [data, setData] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(false);

    // Track the last successfully loaded ID/Range to prevent redundant Skeletons
    const lastSignatureRef = React.useRef<string>('');

    React.useEffect(() => {
        const resolveAndFetch = async () => {
            if (!coingeckoId && !contractAddress) return;

            const currentSignature = `${coingeckoId}:${contractAddress}:${days}`;
            
            // If range hasn't changed, perform a silent background update instead of showing Skeleton
            if (data.length === 0 || lastSignatureRef.current !== currentSignature) {
                setLoading(true);
            }
            
            setError(false);
            
            // Resolve current reference price for synthetic delta validation
            let currentPrice = 0;
            if (coingeckoId === 'internal:wnc') {
                const wnc = allAssets.find(a => a.symbol === 'WNC');
                currentPrice = wnc?.priceUsd || 0.000606;
            } else if (coingeckoId) {
                currentPrice = prices[coingeckoId.toLowerCase()]?.price || 0;
            } else if (contractAddress) {
                currentPrice = prices[contractAddress.toLowerCase()]?.price || 0;
            }

            try {
                const res = await fetchChartData(coingeckoId || '', days, currentPrice, chainId, contractAddress);
                if (!res || res.length === 0) {
                    if (data.length === 0) setError(true);
                } else {
                    setData(res);
                    lastSignatureRef.current = currentSignature;
                }
            } catch (e) {
                if (data.length === 0) setError(true);
            } finally {
                setLoading(false);
            }
        };

        resolveAndFetch();
        
        // Refresh chart data every 5 minutes (standard institutional interval)
        const interval = setInterval(resolveAndFetch, 300000);
        return () => clearInterval(interval);
        
        // CRITICAL FIX: Removed 'prices' and 'allAssets' from dependencies.
        // This prevents the chart from re-fetching and blinking on every live price tick.
    }, [coingeckoId, days, chainId, contractAddress]);

    if (loading && data.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-white/[0.02]">
                <Skeleton className="w-3/4 h-32 rounded-[2.5rem] bg-white/5 animate-pulse" />
                <div className="flex gap-2">
                    <Skeleton className="w-12 h-2 rounded bg-white/5" />
                    <Skeleton className="w-12 h-2 rounded bg-white/5" />
                </div>
            </div>
        );
    }

    if (error && data.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 bg-white/[0.02]">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 opacity-20" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Market Terminal Offline</p>
            </div>
        );
    }

    const linecolor = isNegative ? '#f87171' : '#4ade80';
    const fillcolor = isNegative ? '#f87171' : '#4ade80';

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <defs>
                    <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={fillcolor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={fillcolor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: 'rgba(5, 5, 5, 0.9)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '1.5rem',
                        backdropFilter: 'blur(10px)',
                        padding: '12px'
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: '900' }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                    formatter={(value: any) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`, 'Price']}
                />
                <Area
                    type="monotone"
                    dataKey="price"
                    stroke={linecolor}
                    fill="url(#chart-fill)"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={data.length < 500} // Disable animation for very dense datasets to prevent lag
                    animationDuration={1000}
                />
                <XAxis dataKey="time" hide />
                <YAxis domain={['dataMin', 'dataMax']} hide />
            </AreaChart>
        </ResponsiveContainer>
    );
});

RechartsChart.displayName = 'RechartsChart';

export default RechartsChart;
