'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface TokenManagerProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function TokenManager({ isOpen, onOpenChange }: TokenManagerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Manage Tokens</SheetTitle>
          <SheetDescription>
            Add or remove tokens from your wallet view.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p>Token management interface goes here.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
