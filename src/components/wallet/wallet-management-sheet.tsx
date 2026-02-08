'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { useWallet } from "@/contexts/wallet-provider";
import { useUser } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2, ShieldCheck, Zap } from 'lucide-react';

interface WalletManagementSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function WalletManagementSheet({ isOpen, onOpenChange }: WalletManagementSheetProps) {
  const { isInitialized, custodialAddress } = useWallet();
  const { user } = useUser();
  const db = useFirestore();
  const [isProvisioning, setIsProvisioning] = useState(false);

  const handleCreateCustodialAccount = async () => {
    if (!user || !db) return;
    setIsProvisioning(true);
    
    // In a custodial model, we signal the backend to create the wallet.
    // The backend monitors this collection/flag and updates 'custodialAddress' when ready.
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: user.displayName || user.email?.split('@')[0] || 'User',
        status: 'provisioning',
        createdAt: new Date().toISOString(),
      }, { merge: true });
      
      // We don't close the sheet yet, we show a loading state until custodialAddress appears in context
    } catch (e) {
      console.error("Failed to request account provisioning", e);
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] bg-background p-6"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Welcome to Wevina
          </SheetTitle>
          <SheetDescription className="text-base">
            Your secure, programmable custodial wallet is ready to be provisioned.
          </SheetDescription>
        </SheetHeader>

        <div className="py-8 space-y-6">
          <div className="grid gap-4">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/30">
              <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-sm">Institutional-Grade Security</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Private keys are stored in high-security backend vaults. You never have to worry about losing a seed phrase.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              size="lg" 
              onClick={handleCreateCustodialAccount} 
              className="h-14 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20"
              disabled={isProvisioning || !!custodialAddress}
            >
              {isProvisioning ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Provisioning Account...</>
              ) : custodialAddress ? (
                "Account Active"
              ) : (
                "Create My Wallet"
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground px-8">
              By creating a wallet, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
