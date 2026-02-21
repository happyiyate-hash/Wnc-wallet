'use client';

import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { useWallet } from "@/contexts/wallet-provider";
import { useUser } from "@/contexts/user-provider";
import { Loader2, ShieldCheck, Lock, CloudDownload, Plus, Download, Timer } from 'lucide-react';
import { Textarea } from '../ui/textarea';

interface WalletManagementSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function WalletManagementSheet({ isOpen, onOpenChange }: WalletManagementSheetProps) {
  const { generateWallet, importWallet, restoreFromCloud } = useWallet();
  const { profile } = useUser();
  const [step, setStep] = useState<'start' | 'import'>('start');
  const [importInput, setImportInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Real-time feedback states
  const [status, setStatus] = useState<string>('');
  const [timer, setTimer] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startTimer = () => {
    setTimer(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimer(Date.now() - startTimeRef.current);
    }, 10);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  const handleCreate = async () => {
    setIsProcessing(true);
    setStatus('Generating Keypair...');
    startTimer();
    try {
      await generateWallet();
      setStatus('Complete!');
    } catch (e: any) {
      setStatus('Failed');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        stopTimer();
        setStatus('');
      }, 1000);
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    setStatus('Verifying Phrase...');
    startTimer();
    try {
      await importWallet(importInput);
      setStep('start');
      setImportInput('');
      setStatus('Complete!');
    } catch (e: any) {
      setStatus('Invalid Phrase');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        stopTimer();
        setStatus('');
      }, 1000);
    }
  };

  const handleRestore = async () => {
    setIsProcessing(true);
    setStatus('Connecting...');
    startTimer();
    
    // Status sequence for real-time feedback
    const statusSequence = [
        { msg: 'Fetching Vault...', delay: 200 },
        { msg: 'Decrypting AES-256...', delay: 1200 },
        { msg: 'Validating Mnemonic...', delay: 2000 },
        { msg: 'Access Restored!', delay: 2800 }
    ];

    statusSequence.forEach(({ msg, delay }) => {
        setTimeout(() => {
            if (isProcessing) setStatus(msg);
        }, delay);
    });

    try {
      await restoreFromCloud();
    } catch (e: any) {
      setStatus('Failed');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        stopTimer();
        setStatus('');
      }, 3500);
    }
  };

  const hasCloudBackup = !!profile?.vault_phrase;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom"
        className="rounded-t-[2.5rem] bg-[#0a0a0c] p-6 pt-4 pb-8 border-t border-white/5 max-h-[380px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="text-center space-y-1 mb-4">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-1">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <SheetTitle className="text-lg font-bold">Secure Your Assets</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {isProcessing ? (
                <div className="flex items-center justify-center gap-2 text-primary font-mono text-[10px] tracking-tighter">
                    <Timer className="w-3 h-3 animate-pulse" />
                    {(timer / 1000).toFixed(3)}s
                </div>
            ) : (
                step === 'import' ? 'Enter secret phrase' : 'Choose a setup method'
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2">
          {step === 'start' && (
            <>
              <Button 
                className="w-full h-12 text-sm font-bold rounded-xl gap-3 bg-primary hover:bg-primary/90" 
                onClick={handleCreate}
                disabled={isProcessing}
              >
                {isProcessing && status.includes('Generating') ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="animate-pulse">{status}</span>
                    </div>
                ) : (
                    <><Plus className="w-4 h-4" /> Create New Wallet</>
                )}
              </Button>

              <Button 
                variant="secondary"
                className="w-full h-12 text-sm font-bold rounded-xl gap-3 bg-white/5 hover:bg-white/10" 
                onClick={() => setStep('import')}
                disabled={isProcessing}
              >
                <Download className="w-4 h-4" />
                Import Existing Wallet
              </Button>

              {hasCloudBackup && (
                <Button 
                  variant="outline"
                  className="w-full h-12 text-sm font-bold rounded-xl gap-3 border-primary/20 text-primary hover:bg-primary/5" 
                  onClick={handleRestore}
                  disabled={isProcessing}
                >
                  {isProcessing && !status.includes('Generating') ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-[10px] font-mono">{status}</span>
                    </div>
                  ) : (
                    <><CloudDownload className="w-4 h-4" /> Restore from Cloud Vault</>
                  )}
                </Button>
              )}
            </>
          )}

          {step === 'import' && (
            <div className="space-y-3">
              <Textarea 
                placeholder="12 or 24 words..." 
                className="min-h-[80px] rounded-xl p-3 bg-white/5 border-white/10 focus:border-primary/50 text-sm"
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1 h-10 rounded-xl text-xs" onClick={() => setStep('start')}>
                  Back
                </Button>
                <Button 
                  className="flex-[2] h-10 rounded-xl font-bold text-xs" 
                  onClick={handleImport}
                  disabled={!importInput || isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Restore Access'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-center gap-2 text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
          <ShieldCheck className="w-2.5 h-2.5 text-green-500" />
          Bank-Grade Encryption Active
        </div>
      </SheetContent>
    </Sheet>
  );
}
