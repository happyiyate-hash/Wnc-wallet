'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { useWallet } from "@/contexts/wallet-provider";
import { generateMnemonic, validateMnemonic } from 'bip39';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Textarea } from '../ui/textarea';
import { ArrowRight } from 'lucide-react';

interface WalletManagementSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

enum Step {
    Initial,
    Import,
}

export default function WalletManagementSheet({ isOpen, onOpenChange }: WalletManagementSheetProps) {
  const { createWalletWithMnemonic, importWalletWithMnemonic } = useWallet();
  const [step, setStep] = useState<Step>(Step.Initial);
  const [importMnemonic, setImportMnemonic] = useState('');
  const [importError, setImportError] = useState('');

  const handleCreateWallet = () => {
    const mnemonic = generateMnemonic();
    createWalletWithMnemonic(mnemonic);
    resetStateAndClose();
  };
  
  const handleImport = () => {
    const isValid = validateMnemonic(importMnemonic);
    if (isValid) {
      importWalletWithMnemonic(importMnemonic);
      resetStateAndClose();
    } else {
      setImportError("Invalid mnemonic phrase. Please check your words and try again.");
    }
  };

  const resetStateAndClose = () => {
    setStep(Step.Initial);
    setImportMnemonic('');
    setImportError('');
    onOpenChange(false);
  }

  const renderInitialStep = () => (
    <div className="py-4 flex flex-col gap-4">
        <Button size="lg" onClick={handleCreateWallet} className="h-12 text-base">Create New Wallet</Button>
        <Button size="lg" variant="outline" onClick={() => setStep(Step.Import)} className="h-12 text-base">Import Wallet</Button>
    </div>
  );

  const renderImportStep = () => (
     <div className="py-4 flex flex-col gap-4">
        <Alert variant="default">
            <AlertTitle>Import Wallet</AlertTitle>
            <AlertDescription>
                Enter your 12-word secret recovery phrase to restore your wallet.
            </AlertDescription>
        </Alert>
        <Textarea 
            placeholder="Enter your secret recovery phrase here..."
            value={importMnemonic}
            onChange={(e) => {
                setImportMnemonic(e.target.value);
                if (importError) setImportError('');
            }}
            className="min-h-[100px] text-base"
        />
        {importError && <p className="text-sm text-destructive">{importError}</p>}
         <Button onClick={handleImport} disabled={!importMnemonic.trim()}>
            Import Wallet <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={() => setStep(Step.Initial)}>Back</Button>
     </div>
  );


  return (
    <Sheet open={isOpen} onOpenChange={resetStateAndClose}>
      <SheetContent 
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] bg-background"
        onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus on first input
      >
        <SheetHeader>
          <SheetTitle>Wallet Management</SheetTitle>
          <SheetDescription>
            {step === Step.Initial 
                ? "Create a new wallet or import an existing one."
                : "Restore your wallet using your secret phrase."
            }
          </SheetDescription>
        </SheetHeader>
        {step === Step.Initial && renderInitialStep()}
        {step === Step.Import && renderImportStep()}
      </SheetContent>
    </Sheet>
  );
}
