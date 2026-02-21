'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { useWallet } from "@/contexts/wallet-provider";
import { useUser } from "@/contexts/user-provider";
import { Loader2, ShieldCheck, Lock, CloudDownload, Plus, Download } from 'lucide-react';
import { Textarea } from '../ui/textarea';

interface WalletManagementSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function WalletManagementSheet({ isOpen, onOpenChange }: WalletManagementSheetProps) {
  const { generateWallet, importWallet, restoreFromCloud, wallets } = useWallet();
  const { profile } = useUser();
  const [step, setStep] = useState<'start' | 'import'>('start');
  const [importInput, setImportInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCreate = async () => {
    setIsProcessing(true);
    try {
      await generateWallet();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    try {
      await importWallet(importInput);
      setStep('start');
      setImportInput('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setIsProcessing(true);
    try {
      await restoreFromCloud();
    } finally {
      setIsProcessing(false);
    }
  };

  const hasCloudBackup = !!profile?.vault_phrase;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom"
        className="rounded-t-[2rem] bg-[#0a0a0c] p-6 pt-4 pb-8 border-t border-white/5 max-h-[420px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="text-center space-y-1 mb-4">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-1">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <SheetTitle className="text-lg font-bold">Secure Your Assets</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {step === 'import' ? 'Enter secret phrase' : 'Choose a setup method'}
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
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create New Wallet
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
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                  Restore from Cloud Vault
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