
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';

interface CurrencyContextType {
  selectedCurrency: string;
  setCurrency: (code: string) => void;
  rates: { [key: string]: number };
  currentSymbol: string;
  formatFiat: (val: number, decimals?: number) => string;
  isLoadingRates: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const SYMBOLS: { [key: string]: string } = {
  USD: '$', NGN: '₦', EUR: '€', GBP: '£', KES: 'KSh', GHS: 'GH₵', ZAR: 'R', CAD: 'CA$', JPY: '¥', CNY: '¥', INR: '₹'
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [rates, setRates] = useState<{ [key: string]: number }>({ USD: 1, NGN: 1650, EUR: 0.92, GBP: 0.77, KES: 129, GHS: 16, ZAR: 17.5 });
  const [isLoadingRates, setIsLoadingRates] = useState(true);

  const fetchLiveRates = useCallback(async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/exchange_rates');
      const data = await res.json();
      
      if (data && data.rates) {
        const btcToUsd = data.rates.usd.value;
        const normalizedRates: { [key: string]: number } = {};
        
        // Normalize all rates to USD base
        Object.keys(data.rates).forEach(key => {
          const rateData = data.rates[key];
          const code = key.toUpperCase();
          normalizedRates[code] = rateData.value / btcToUsd;
        });

        setRates(prev => ({ ...prev, ...normalizedRates }));
        setIsLoadingRates(false);
      }
    } catch (e) {
      console.warn("[CURRENCY_ENGINE_ADVISORY] Live forex handshake failed. Using cached baseline.");
      setIsLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('selected_currency');
    if (saved) setSelectedCurrency(saved);
    
    fetchLiveRates();
    const interval = setInterval(fetchLiveRates, 15 * 60 * 1000); // 15 min refresh
    return () => clearInterval(interval);
  }, [fetchLiveRates]);

  const setCurrency = useCallback((code: string) => {
    setSelectedCurrency(code);
    localStorage.setItem('selected_currency', code);
  }, []);

  const currentSymbol = SYMBOLS[selectedCurrency] || selectedCurrency;

  const formatFiat = useCallback((val: number, decimals?: number) => {
    const rate = rates[selectedCurrency] || 1;
    const converted = val * rate;
    
    // Auto-detect precision for micro-assets like WNC/USD
    const precision = decimals !== undefined ? decimals : (converted < 0.01 && converted > 0 ? 6 : 2);
    
    return `${currentSymbol}${converted.toLocaleString('en-US', { 
      minimumFractionDigits: precision, 
      maximumFractionDigits: precision 
    })}`;
  }, [selectedCurrency, rates, currentSymbol]);

  const value = useMemo(() => ({
    selectedCurrency,
    setCurrency,
    rates,
    currentSymbol,
    formatFiat,
    isLoadingRates
  }), [selectedCurrency, setCurrency, rates, currentSymbol, formatFiat, isLoadingRates]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
};
