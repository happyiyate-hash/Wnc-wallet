'use client';
import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchChartData } from '@/lib/coingecko';

const RechartsChart = ({ coingeckoId, days, isNegative }: { coingeckoId?: string | null, days: string, isNegative: boolean }) => {
    const [data, setData] = React.useState([]);

    React.useEffect(() => {
        if (coingeckoId) {
            fetchChartData(coingeckoId, days).then(setData);
        }
    }, [coingeckoId, days]);

    const linecolor = isNegative ? '#f87171' : '#4ade80';
    const fillcolor = isNegative ? '#f87171' : '#4ade80';

    return (
        <ResponsiveContainer width="100%" height="100%">
            {/* REMOVED HORIZONTAL MARGINS FOR FULL-BLEED LOOK */}
            <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <defs>
                    <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={fillcolor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={fillcolor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: 'rgba(20, 20, 20, 0.8)', 
                        border: '1px solid #444', 
                        borderRadius: '0.5rem'
                    }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                    formatter={(value: any) => [`$${value.toFixed(2)}`, 'Price']}
                />
                <Area
                    type="monotone"
                    dataKey="price"
                    stroke={linecolor}
                    fill="url(#chart-fill)"
                    strokeWidth={2}
                    dot={false}
                />
                <XAxis dataKey="time" hide />
                <YAxis domain={['dataMin', 'dataMax']} hide />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export default RechartsChart;
