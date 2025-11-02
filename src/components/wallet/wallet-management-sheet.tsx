'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { useWallet } from "@/contexts/wallet-provider";
import { generateMnemonic } from 'bip39';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Eye, EyeOff, Copy, ArrowRight } from 'lucide-react';

interface WalletManagementSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

enum CreateWalletStep {
    Initial,
    ShowMnemonic,
    ConfirmMnemonic,
}

const MnemonicWord = ({ word, index }: { word: string; index: number }) => (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
        <span className="text-xs text-muted-foreground">{index + 1}</span>
        <span className="font-semibold">{word}</span>
    </div>
);

export default function WalletManagementSheet({ isOpen, onOpenChange }: WalletManagementSheetProps) {
  const { createWalletWithMnemonic, importWalletWithMnemonic } = useWallet();
  const [step, setStep] = useState<CreateWalletStep>(CreateWalletStep.Initial);
  const [newMnemonic, setNewMnemonic] = useState('');
  const [isMnemonicVisible, setIsMnemonicVisible] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleGenerateMnemonic = () => {
    const mnemonic = generateMnemonic();
    setNewMnemonic(mnemonic);
    setStep(CreateWalletStep.ShowMnemonic);
    setIsMnemonicVisible(false);
    setIsConfirmed(false);
  };

  const handleMnemonicCopied = () => {
    navigator.clipboard.writeText(newMnemonic);
    // You can add a toast notification here
  };

  const handleFinishCreation = () => {
    if (!isConfirmed) {
        // You can show a toast or alert here
        alert("Please confirm you have saved your mnemonic phrase.");
        return;
    }
    createWalletWithMnemonic(newMnemonic);
    resetStateAndClose();
  };

  const resetStateAndClose = () => {
    setStep(CreateWalletStep.Initial);
    setNewMnemonic('');
    setIsMnemonicVisible(false);
    setIsConfirmed(false);
    onOpenChange(false);
  }

  const renderInitialStep = () => (
    <div className="py-4 flex flex-col gap-4">
        <Button onClick={handleGenerateMnemonic}>Create New Wallet</Button>
        <Button variant="outline">Import Wallet</Button>
    </div>
  );

  const renderShowMnemonicStep = () => (
    <div className="py-4 flex flex-col gap-4">
        <Alert>
            <AlertTitle>Save Your Mnemonic Phrase</AlertTitle>
            <AlertDescription>
                Write down these 12 words in order. Keep them safe and secret. This is the only way to recover your wallet.
            </AlertDescription>
        </Alert>

        <div className="relative rounded-lg border bg-background p-4">
             <div className={`grid grid-cols-3 gap-3 transition-opacity duration-300 ${isMnemonicVisible ? 'opacity-100' : 'opacity-0 blur-md'}`}>
                {newMnemonic.split(' ').map((word, index) => (
                    <MnemonicWord key={index} word={word} index={index} />
                ))}
            </div>
            {!isMnemonicVisible && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                    <Eye className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-semibold">Tap to reveal your phrase</p>
                    <p className="text-xs text-muted-foreground">Make sure nobody is watching.</p>
                </div>
            )}
             <button onClick={() => setIsMnemonicVisible(true)} className="absolute inset-0" aria-label="Reveal mnemonic" />
        </div>
       
        <Button variant="ghost" onClick={handleMnemonicCopied} className="flex items-center gap-2">
            <Copy className="h-4 w-4" /> Copy Phrase
        </Button>
        
         <div className="flex items-start space-x-3 mt-4 p-3 bg-muted/50 rounded-lg">
            <input 
                type="checkbox" 
                id="confirm-save"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
            />
            <label htmlFor="confirm-save" className="text-sm text-muted-foreground">
               I have saved my secret recovery phrase. I understand that losing it means losing access to my wallet.
            </label>
        </div>

        <Button onClick={handleFinishCreation} disabled={!isConfirmed}>
            Complete Setup <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={resetStateAndClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Wallet Management</SheetTitle>
          <SheetDescription>
            {step === CreateWalletStep.Initial 
                ? "Create a new wallet or import an existing one."
                : "Securely save your new wallet's recovery phrase."
            }
          </SheetDescription>
        </SheetHeader>
        {step === CreateWalletStep.Initial && renderInitialStep()}
        {step === CreateWalletStep.ShowMnemonic && renderShowMnemonicStep()}
      </SheetContent>
    </Sheet>
  );
}
