'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { useWallet } from "@/contexts/wallet-provider";
import { useUser } from '@/contexts/user-provider';
import { supabase } from '@/lib/supabase/client';
import { Loader2, ShieldCheck, Zap, Lock } from 'lucide-react';

interface WalletManagementSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function WalletManagementSheet({ isOpen, onOpenChange }: WalletManagementSheetProps) {
  const { isInitialized, wallets } = useWallet();
  const { user } = useUser();
  const [isProvisioning, setIsProvisioning] = useState(false);

  const handleCreateCustodialAccount = async () => {
    if (!user) return;
    setIsProvisioning(true);
    
    try {
      // In our custodial model, we signal the backend to provision the multi-chain wallets.
      // We do this by creating a placeholder entry that the Python scanner/provisioner picks up.
      const { error } = await supabase
        .from('wallets')
        .insert({
          user_id: user.id,
          address: 'PROVISIONING', // Backend will replace this with real derived addresses
          derivation_path: 'm/44/...'
        });

      if (error) throw error;
      
      // The WalletProvider is listening for changes. Once the backend updates the wallet address,
      // the UI will update automatically.
    } catch (e) {
      console.error("Failed to request account provisioning", e);
    } finally {
      // We keep the loading state until the provider detects a real wallet
      setTimeout(() => setIsProvisioning(false), 2000);
    }
  };

  const hasWallet = wallets && Object.keys(wallets).length > 0;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom"
        className="rounded-t-3xl max-h-[90vh] bg-background p-8 border-t border-white/10"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="text-left space-y-4">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <SheetTitle className="text-3xl font-bold">
            Custodial Security
          </SheetTitle>
          <SheetDescription className="text-lg text-muted-foreground">
            Wevina handles the complex parts of crypto so you don't have to. No seed phrases, no lost keys.
          </SheetDescription>
        </SheetHeader>

        <div className="py-8 space-y-8">
          <div className="grid gap-6">
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-secondary/30 border border-white/5">
              <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <p className="font-bold text-base">Institutional Custody</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your private keys are secured in air-gapped hardware security modules (HSMs).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-secondary/30 border border-white/5">
              <Lock className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <p className="font-bold text-base">Zero-Knowledge Management</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Programmable limits and multi-sig recovery ensure your funds are always safe.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <Button 
              size="lg" 
              onClick={handleCreateCustodialAccount} 
              className="h-16 text-xl font-bold rounded-2xl shadow-2xl shadow-primary/20 transition-all active:scale-95"
              disabled={isProvisioning || hasWallet}
            >
              {isProvisioning ? (
                <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Provisioning...</>
              ) : hasWallet ? (
                "Account Verified"
              ) : (
                "Activate My Custodial Wallet"
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground px-10 leading-relaxed">
              By activating, you agree to our <span className="text-primary font-semibold">Terms of Service</span>. Your account will be provisioned across all supported networks.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
