'use client';
import React, { memo, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchChartData } from '@/lib/coingecko';
import { Skeleton } from './ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface RechartsChartProps {
    coingeckoId?: string | null;
    days: string;
    isNegative: boolean;
    chainId?: number;
    contractAddress?: string;
    currentPrice?: number;
}

/**
 * RECHART TERMINAL COMPONENT
 * Optimized for "Binary Style" live updates where the leading edge wiggles in real-time.
 * Wrapped in memo to prevent high-frequency re-renders from the live price ticker.
 */
const RechartsChart = memo(({ coingeckoId, days, isNegative, chainId, contractAddress, currentPrice }: RechartsChartProps) => {
    const [historicalData, setHistoricalData] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(false);

    // Track the last successfully loaded ID/Range to prevent redundant Skeletons
    const lastSignatureRef = React.useRef<string>('');

    React.useEffect(() => {
        const resolveAndFetch = async () => {
            if (!coingeckoId && !contractAddress) return;

            const currentSignature = `${coingeckoId}:${contractAddress}:${days}`;
            
            // If range hasn't changed, perform a silent background update instead of showing Skeleton
            if (historicalData.length === 0 || lastSignatureRef.current !== currentSignature) {
                setLoading(true);
            }
            
            setError(false);

            try {
                // We fetch the historical baseline. We pass the currentPrice to help generate synthetic data if needed.
                const res = await fetchChartData(coingeckoId || '', days, currentPrice, chainId, contractAddress);
                if (!res || res.length === 0) {
                    if (historicalData.length === 0) setError(true);
                } else {
                    setHistoricalData(res);
                    lastSignatureRef.current = currentSignature;
                }
            } catch (e) {
                if (historicalData.length === 0) setError(true);
            } finally {
                setLoading(false);
            }
        };

        resolveAndFetch();
        
        // Refresh historical baseline every 5 minutes
        const interval = setInterval(resolveAndFetch, 300000);
        return () => clearInterval(interval);
    }, [coingeckoId, days, chainId, contractAddress]);

    /**
     * LIVE EDGE MERGER
     * Injects the high-frequency currentPrice into the data array for a "live" feel.
     * This creates the wiggle effect at the end of the line.
     */
    const chartData = useMemo(() => {
        if (!historicalData || historicalData.length === 0) return [];
        if (!currentPrice) return historicalData;

        const lastPoint = historicalData[historicalData.length - 1];
        const now = Date.now();

        // If the update is within 60 seconds of the last point, replace it to simulate live movement.
        // Otherwise, append a new point to make the chart "grow" until the next historical refresh.
        if (now - lastPoint.time < 60000) {
            const newData = [...historicalData];
            newData[newData.length - 1] = { ...lastPoint, price: currentPrice, time: now };
            return newData;
        } else {
            return [...historicalData, { time: now, price: currentPrice }];
        }
    }, [historicalData, currentPrice]);

    if (loading && historicalData.length === 0) {
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

    if (error && historicalData.length === 0) {
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
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
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
                    isAnimationActive={false} // IMPORTANT: Prevents entrance flickering on every price update
                />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} hide />
            </AreaChart>
        </ResponsiveContainer>
    );
});

RechartsChart.displayName = 'RechartsChart';

export default RechartsChart;
