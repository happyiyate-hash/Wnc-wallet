'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/wallet-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowUpDown, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TokenLogoDynamic from '@/components/shared/TokenLogoDynamic';
import { currencyConversionWithLLMValidation } from '@/app/actions';
import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/contexts/user-provider';
import { cn } from '@/lib/utils';

export default function SwapPage() {
  const { allAssets, viewingNetwork } = useWallet();
  const { user } = useUser();
  const router = useRouter();

  const [fromToken, setFromToken] = useState(allAssets[0] || null);
  const [toToken, setToToken] = useState(allAssets[1] || null);
  const [amount, setAmount] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const balance = parseFloat(fromToken?.balance || '0');
  const canValidate = parseFloat(amount) > 0 && parseFloat(amount) <= balance && fromToken && toToken;

  const handleValidateSwap = async () => {
    if (!canValidate) return;
    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await currencyConversionWithLLMValidation({
        fromCurrency: fromToken.symbol,
        toCurrency: toToken.symbol,
        amount: parseFloat(amount),
      });
      setValidationResult(result);
    } catch (e) {
      console.error("Validation failed", e);
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmSwap = async () => {
    if (!user || !validationResult?.isValid) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'swap',
          amount: parseFloat(amount),
          status: 'pending',
          timestamp: new Date().toISOString()
        });
      
      if (error) throw error;
      router.push('/');
    } catch (e) {
      console.error("Swap submission failed", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 flex items-center gap-2 border-b border-white/5">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Swap Assets</h1>
      </header>

      <main className="flex-1 p-6 space-y-4 overflow-y-auto">
        <div className="p-6 rounded-3xl bg-secondary/40 border border-white/5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-muted-foreground uppercase">From</span>
            <span className="text-xs text-muted-foreground">Balance: {fromToken?.balance}</span>
          </div>
          <div className="flex items-center gap-4">
            <Input 
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-3xl font-bold bg-transparent border-none p-0 focus-visible:ring-0"
            />
            <Button variant="outline" className="rounded-full gap-2 h-10 px-4">
              <TokenLogoDynamic logoUrl={fromToken?.iconUrl} alt={fromToken?.symbol || ''} size={24} chainId={fromToken?.chainId} />
              {fromToken?.symbol}
            </Button>
          </div>
        </div>

        <div className="flex justify-center -my-6 relative z-10">
          <Button 
            size="icon" 
            variant="outline" 
            className="rounded-xl bg-background border-white/5 h-10 w-10 shadow-xl"
            onClick={() => {
              const temp = fromToken;
              setFromToken(toToken);
              setToToken(temp);
            }}
          >
            <ArrowUpDown className="w-4 h-4 text-primary" />
          </Button>
        </div>

        <div className="p-6 rounded-3xl bg-secondary/40 border border-white/5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-muted-foreground uppercase">To (Estimated)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-3xl font-bold">
              {validationResult?.convertedAmount?.toFixed(6) || '0.00'}
            </div>
            <Button variant="outline" className="rounded-full gap-2 h-10 px-4">
              <TokenLogoDynamic logoUrl={toToken?.iconUrl} alt={toToken?.symbol || ''} size={24} chainId={toToken?.chainId} />
              {toToken?.symbol}
            </Button>
          </div>
        </div>

        {validationResult && (
          <div className={cn(
            "p-4 rounded-2xl flex items-start gap-3 border animate-in fade-in slide-in-from-top-2",
            validationResult.isValid ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-destructive/10 border-destructive/20 text-destructive"
          )}>
            {validationResult.isValid ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <div className="text-sm">
              <p className="font-bold">{validationResult.isValid ? 'Rate Validated' : 'Suspicious Rate Detected'}</p>
              <p className="opacity-80">{validationResult.isValid ? 'AI confirms this conversion rate is plausible and safe.' : validationResult.validationReason}</p>
            </div>
          </div>
        )}

        <div className="pt-4">
          {!validationResult ? (
            <Button 
              className="w-full h-16 rounded-2xl text-lg font-bold"
              disabled={!canValidate || isValidating}
              onClick={handleValidateSwap}
            >
              {isValidating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Verify with AI"}
            </Button>
          ) : (
            <Button 
              className="w-full h-16 rounded-2xl text-lg font-bold"
              disabled={!validationResult.isValid || isSubmitting}
              onClick={handleConfirmSwap}
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Confirm Swap"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
