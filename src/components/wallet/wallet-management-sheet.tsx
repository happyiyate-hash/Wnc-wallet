'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { useWallet } from "@/contexts/wallet-provider";

interface WalletManagementSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

const generateRandomString = (length = 42) => {
  const chars = '0123456789abcdef';
  let result = '0x';
  for (let i = length - 2; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
};


export default function WalletManagementSheet({ isOpen, onOpenChange }: WalletManagementSheetProps) {
  const { setWallets } = useWallet();

  const handleCreateWallet = () => {
    const newWallet = {
      address: generateRandomString(),
    };
    setWallets([newWallet]);
    onOpenChange(false);
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Wallet Management</SheetTitle>
          <SheetDescription>
            Create a new wallet or import an existing one.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 flex flex-col gap-4">
          <Button onClick={handleCreateWallet}>Create New Wallet</Button>
          <Button variant="outline">Import Wallet</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
