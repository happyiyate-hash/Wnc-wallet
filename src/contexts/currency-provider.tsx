
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CurrencyContextType {
  selectedCurrency: string;
  setCurrency: (code: string) => void;
  rates: { [key: string]: number };
  currentSymbol: string;
  formatFiat: (val: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const SYMBOLS: { [key: string]: string } = {
  USD: '$', NGN: '₦', EUR: '€', GBP: '£', KES: 'KSh', GHS: 'GH₵', ZAR: 'R'
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [rates, setRates] = useState({ USD: 1, NGN: 1650, EUR: 0.92, GBP: 0.77, KES: 129, GHS: 16, ZAR: 17.5 });

  useEffect(() => {
    const saved = localStorage.getItem('selected_currency');
    if (saved) setSelectedCurrency(saved);
  }, []);

  const setCurrency = (code: string) => {
    setSelectedCurrency(code);
    localStorage.setItem('selected_currency', code);
  };

  const currentSymbol = SYMBOLS[selectedCurrency] || selectedCurrency;

  const formatFiat = (val: number) => {
    const rate = rates[selectedCurrency] || 1;
    const converted = val * rate;
    return `${currentSymbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setCurrency, rates, currentSymbol, formatFiat }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
};
