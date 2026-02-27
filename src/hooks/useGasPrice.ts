
'use client';

import { useState, useEffect } from 'react';

export function useGasPrice(chainId?: number) {
  const [data, setData] = useState({
    priceGwei: '2',
    nativeFee: '0.0001',
    estimatedTime: '15s',
    status: 'idle' as 'idle' | 'loading'
  });

  useEffect(() => {
    if (!chainId) return;
    setData(prev => ({ ...prev, status: 'loading' }));
    const timer = setTimeout(() => {
      setData({
        priceGwei: (Math.random() * 5 + 1).toFixed(1),
        nativeFee: (Math.random() * 0.0005 + 0.0001).toFixed(5),
        estimatedTime: '12s',
        status: 'idle'
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [chainId]);

  return data;
}
