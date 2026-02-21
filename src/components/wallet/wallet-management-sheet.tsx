'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { useWallet } from "@/contexts/wallet-provider";
import { useUser } from "@/contexts/user-provider";
import { Loader2, ShieldCheck, Lock, Copy, CheckCircle2, CloudUpload } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

interface WalletManagementSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function WalletManagementSheet({ isOpen, onOpenChange }: WalletManagementSheetProps) {
  const { generateWallet, importWallet, wallets, backupToCloud } = useWallet();
  const { user, profile } = useUser();
  const [step, setStep] = useState<'start' | 'generate' | 'import'>('start');
  const [mnemonic, setMnemonic] = useState('');
  const [importInput, setImportInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCopied, copy] = useCopyToClipboard();

  const handleGenerate = () => {
    const m = generateWallet();
    setMnemonic(m);
    setStep('generate');
  };

  const handleImport = () => {
    setIsProcessing(true);
    try {
      importWallet(importInput);
      onOpenChange(false);
      setStep('start');
      setImportInput('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloudBackup = async () => {
    setIsProcessing(true);
    await backupToCloud();
    setIsProcessing(false);
  };

  const hasWallet = wallets && wallets.length > 0;
  const isCloudBackedUp = !!profile?.vault_phrase;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom"
        className="rounded-t-3xl max-h-[95vh] bg-background p-8 border-t border-white/10 overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="text-left space-y-4">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <SheetTitle className="text-3xl font-bold">
            {step === 'generate' ? 'Backup Seed Phrase' : step === 'import' ? 'Import Wallet' : 'Your Keys, Your Crypto'}
          </SheetTitle>
          <SheetDescription className="text-lg text-muted-foreground">
            {step === 'generate' ? 'Write down these 12 words in order. Never share them with anyone.' : 
             step === 'import' ? 'Paste your 12 or 24 word mnemonic phrase to restore your wallet.' :
             'In a non-custodial wallet, you are the only one in control of your funds.'}
          </SheetDescription>
        </SheetHeader>

        <div className="py-8 space-y-6">
          {step === 'start' && (
            <div className="grid gap-4">
              {hasWallet ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
                    <p className="font-bold text-green-400">Wallet Active</p>
                    <p className="text-sm opacity-80">{wallets[0].address}</p>
                  </div>
                  
                  {user && !isCloudBackedUp && (
                    <Button 
                      className="w-full h-16 text-lg font-bold rounded-2xl gap-3" 
                      onClick={handleCloudBackup}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <Loader2 className="animate-spin" /> : <CloudUpload className="w-6 h-6" />}
                      Sync to Secure Vault
                    </Button>
                  )}
                  
                  {isCloudBackedUp && (
                    <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                      <CheckCircle2 className="w-5 h-5" /> Secured in Cloud Vault
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Button 
                    size="lg" 
                    onClick={handleGenerate} 
                    className="h-16 text-xl font-bold rounded-2xl"
                  >
                    Create New Wallet
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={() => setStep('import')} 
                    className="h-16 text-xl font-bold rounded-2xl"
                  >
                    Import Existing Wallet
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 'generate' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-secondary/30 border border-white/10 grid grid-cols-3 gap-2">
                {mnemonic.split(' ').map((word, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span className="font-bold">{word}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full h-12 gap-2" onClick={() => copy(mnemonic)}>
                {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Copy Phrase
              </Button>
              <Button className="w-full h-16 text-lg font-bold" onClick={() => setStep('start')}>
                I've Saved It
              </Button>
            </div>
          )}

          {step === 'import' && (
            <div className="space-y-6">
              <Textarea 
                placeholder="word1 word2 word3..." 
                className="min-h-[120px] rounded-2xl p-4 bg-secondary/20"
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
              />
              <Button 
                className="w-full h-16 text-lg font-bold" 
                onClick={handleImport}
                disabled={!importInput || isProcessing}
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : 'Restore Wallet'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep('start')}>
                Go Back
              </Button>
            </div>
          )}

          <div className="grid gap-6 opacity-60">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/10 border border-white/5">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Military-Grade Encryption</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your keys are encrypted on the server and only you can unlock them.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
