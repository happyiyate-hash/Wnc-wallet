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
      generateWallet();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    setIsProcessing(true);
    try {
      importWallet(importInput);
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
    await restoreFromCloud();
    setIsProcessing(false);
  };

  const hasCloudBackup = !!profile?.vault_phrase;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom"
        className="rounded-t-[2rem] bg-[#0a0a0c] p-6 border-t border-white/5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="text-center space-y-2 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <SheetTitle className="text-xl font-bold">Secure Your Assets</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {step === 'import' ? 'Enter your secret phrase' : 'Choose how you want to set up your wallet.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          {step === 'start' && (
            <>
              <Button 
                className="w-full h-14 text-base font-bold rounded-2xl gap-3 bg-primary hover:bg-primary/90" 
                onClick={handleCreate}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Plus className="w-5 h-5" />}
                Create New Wallet
              </Button>

              <Button 
                variant="secondary"
                className="w-full h-14 text-base font-bold rounded-2xl gap-3 bg-white/5 hover:bg-white/10" 
                onClick={() => setStep('import')}
                disabled={isProcessing}
              >
                <Download className="w-5 h-5" />
                Import Existing Wallet
              </Button>

              {hasCloudBackup && (
                <Button 
                  variant="outline"
                  className="w-full h-14 text-base font-bold rounded-2xl gap-3 border-primary/20 text-primary hover:bg-primary/5" 
                  onClick={handleRestore}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <CloudDownload className="w-5 h-5" />}
                  Restore from Cloud Vault
                </Button>
              )}
            </>
          )}

          {step === 'import' && (
            <div className="space-y-4">
              <Textarea 
                placeholder="Enter 12 or 24 words separated by spaces..." 
                className="min-h-[100px] rounded-xl p-4 bg-white/5 border-white/10 focus:border-primary/50"
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setStep('start')}>
                  Back
                </Button>
                <Button 
                  className="flex-[2] h-12 rounded-xl font-bold" 
                  onClick={handleImport}
                  disabled={!importInput || isProcessing}
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : 'Restore Access'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
          <ShieldCheck className="w-3 h-3 text-green-500" />
          Bank-Grade Encryption Active
        </div>
      </SheetContent>
    </Sheet>
  );
}
