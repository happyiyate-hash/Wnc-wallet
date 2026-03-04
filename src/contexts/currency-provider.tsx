
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';

interface CurrencyContextType {
  selectedCurrency: string;
  setCurrency: (code: string) => void;
  rates: { [key: string]: number };
  currentSymbol: string;
  formatFiat: (val: number, decimals?: number) => string;
  convertFromUsd: (val: number) => number;
  isLoadingRates: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const SYMBOLS: { [key: string]: string } = {
  USD: '$', 
  NGN: '₦', 
  EUR: '€', 
  GBP: '£', 
  KES: 'KSh', 
  GHS: 'GH₵', 
  ZAR: 'R', 
  CAD: 'CA$', 
  JPY: '¥', 
  CNY: '¥', 
  INR: '₹',
  AUD: 'A$',
  CHF: 'Fr',
  SGD: 'S$',
  HKD: 'HK$',
  BRL: 'R$',
  MXN: 'Mex$'
};

/**
 * INSTITUTIONAL CURRENCY & FOREX ENGINE
 * Version: 3.2.0 (Global Registry Expansion)
 * Handles real-time exchange rate discovery and mathematical conversion.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  // Institutional fallback rates (Baseline 2024/2025)
  const [rates, setRates] = useState<{ [key: string]: number }>({ 
    USD: 1, 
    NGN: 1650, 
    EUR: 0.92, 
    GBP: 0.77, 
    KES: 129, 
    GHS: 16, 
    ZAR: 17.5,
    AUD: 1.52,
    CAD: 1.38,
    CHF: 0.88,
    JPY: 154,
    CNY: 7.24,
    INR: 84.4,
    SGD: 1.34,
    HKD: 7.78
  });
  const [isLoadingRates, setIsLoadingRates] = useState(true);

  const fetchLiveRates = useCallback(async () => {
    try {
      // CoinGecko /exchange_rates returns data relative to BTC
      const res = await fetch('https://api.coingecko.com/api/v3/exchange_rates');
      const data = await res.json();
      
      if (data && data.rates) {
        const btcToUsdRate = data.rates.usd.value;
        const normalizedRates: { [key: string]: number } = {};
        
        // Normalize all rates to USD base (USD = 1)
        // Math: (BTC/Target) / (BTC/USD) = USD/Target
        Object.keys(data.rates).forEach(key => {
          const rateData = data.rates[key];
          const code = key.toUpperCase();
          normalizedRates[code] = rateData.value / btcToUsdRate;
        });

        // Ensure absolute fallback for USD
        if (!normalizedRates['USD']) normalizedRates['USD'] = 1;

        setRates(prev => ({ ...prev, ...normalizedRates }));
        setIsLoadingRates(false);
        console.log(`[FOREX_SYNC] Registry updated. USD/NGN: ${normalizedRates['NGN']?.toFixed(2)}`);
      }
    } catch (e) {
      console.warn("[CURRENCY_ENGINE_ADVISORY] Live forex handshake failed. Using cached baseline.");
      setIsLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selected_currency');
      if (saved) setSelectedCurrency(saved);
    }
    
    fetchLiveRates();
    const interval = setInterval(fetchLiveRates, 15 * 60 * 1000); // 15 min institutional refresh
    return () => clearInterval(interval);
  }, [fetchLiveRates]);

  const setCurrency = useCallback((code: string) => {
    setSelectedCurrency(code);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_currency', code);
    }
  }, []);

  const convertFromUsd = useCallback((val: number) => {
    const rate = rates[selectedCurrency] || rates['USD'] || 1;
    return val * rate;
  }, [selectedCurrency, rates]);

  const currentSymbol = SYMBOLS[selectedCurrency] || selectedCurrency;

  const formatFiat = useCallback((val: number, decimals?: number) => {
    const converted = convertFromUsd(val);
    
    // AUTO-PRECISION SENTINEL
    // Standard assets get 2 decimals. Micro-assets (like WNC in USD) get 6.
    const precision = decimals !== undefined 
      ? decimals 
      : (converted < 0.01 && converted > 0 ? 6 : 2);
    
    return `${currentSymbol}${converted.toLocaleString('en-US', { 
      minimumFractionDigits: precision, 
      maximumFractionDigits: precision 
    })}`;
  }, [currentSymbol, convertFromUsd]);

  const value = useMemo(() => ({
    selectedCurrency,
    setCurrency,
    rates,
    currentSymbol,
    formatFiat,
    convertFromUsd,
    isLoadingRates
  }), [selectedCurrency, setCurrency, rates, currentSymbol, formatFiat, convertFromUsd, isLoadingRates]);

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
