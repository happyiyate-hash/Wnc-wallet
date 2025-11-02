'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/wallet-provider';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info } from 'lucide-react';
import Link from 'next/link';

interface ApiKeyManagerProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function ApiKeyManager({ isOpen, onOpenChange }: ApiKeyManagerProps) {
  const { infuraApiKey, setInfuraApiKey, isInitialized } = useWallet();
  const [currentKey, setCurrentKey] = useState('');

  useEffect(() => {
    if (isInitialized && infuraApiKey) {
      setCurrentKey(infuraApiKey);
    }
  }, [isInitialized, infuraApiKey]);

  const handleSave = () => {
    setInfuraApiKey(currentKey);
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Manage API Keys</SheetTitle>
          <SheetDescription>
            Provide your personal Infura API key to connect to blockchain networks.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4 space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Why provide a key?</AlertTitle>
            <AlertDescription>
                Using your own API key ensures reliable access to blockchain data. This app does not come with a default key.
                You can get a free key from the{' '}
                <Link href="https://www.infura.io/register" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
                    Infura website
                </Link>.
            </AlertDescription>
          </Alert>

          <div className='space-y-2'>
            <Label htmlFor="infura-key">Infura API Key</Label>
            <Input
              id="infura-key"
              type="password"
              placeholder="Paste your Infura API key here"
              value={currentKey}
              onChange={(e) => setCurrentKey(e.target.value)}
            />
          </div>
          
          <Button onClick={handleSave} className="w-full" disabled={!currentKey}>
            Save and Use Key
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}