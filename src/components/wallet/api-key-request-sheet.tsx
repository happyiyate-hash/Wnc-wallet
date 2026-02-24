'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/wallet-provider";
import { KeyRound, Info, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { ethers } from 'ethers';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function ApiKeyRequestSheet({ 
  isOpen, 
  onOpenChange 
}: { 
  isOpen: boolean; 
  onOpenChange: (open: boolean) => void; 
}) {
  const { setInfuraApiKey, refresh } = useWallet();
  const [keyInput, setKeyInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const validateAndSave = async () => {
    if (!keyInput.trim()) return;

    setIsValidating(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      // Simple validation check using a basic JSON-RPC call to Ethereum Mainnet
      const provider = new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${keyInput.trim()}`);
      await provider.getBlockNumber();
      
      // Success
      setInfuraApiKey(keyInput.trim());
      setStatus('success');
      setTimeout(() => {
        onOpenChange(false);
        refresh(); // Trigger balance fetch immediately
      }, 1500);
    } catch (error) {
      console.warn("API Key validation failed:", error);
      setStatus('error');
      setErrorMessage("This key seems invalid. Please check and try again.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-[2.5rem] bg-[#0a0a0c] p-6 pt-4 pb-10 border-t border-white/10 max-h-[450px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <SheetTitle className="text-xl font-bold">Connect to Blockchain</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground leading-relaxed px-4">
            To fetch live balances and prices, you need to provide an Infura API Key. This ensures your wallet has a private, reliable connection.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 max-w-sm mx-auto">
          <div className="space-y-2">
            <div className="relative">
              <Input 
                placeholder="Paste your Infura API key"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  if (status !== 'idle') setStatus('idle');
                }}
                disabled={isValidating || status === 'success'}
                className={cn(
                  "h-14 rounded-2xl bg-white/5 border-white/10 focus:border-primary/50 px-4 text-base font-mono",
                  status === 'error' && "border-destructive/50 focus:border-destructive",
                  status === 'success' && "border-green-500/50 focus:border-green-500"
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValidating && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                {status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                {status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
              </div>
            </div>
            
            {status === 'error' && (
              <p className="text-xs text-destructive font-medium pl-2 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                <AlertCircle className="w-3 h-3" /> {errorMessage}
              </p>
            )}
          </div>

          <Button 
            className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
            onClick={validateAndSave}
            disabled={!keyInput.trim() || isValidating || status === 'success'}
          >
            {isValidating ? 'Validating Connection...' : 'Save & Connect'}
          </Button>

          <div className="pt-2">
            <Link 
              href="https://www.infura.io/register" 
              target="_blank" 
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors group"
            >
              Don't have a key? Get one for free at Infura.io
              <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
          <Info className="w-3 h-3 text-primary" />
          Keys are stored locally on your device
        </div>
      </SheetContent>
    </Sheet>
  );
}
