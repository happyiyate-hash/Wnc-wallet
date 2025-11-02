'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/wallet-provider';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { ethers } from 'ethers';
import { cn } from '@/lib/utils';

interface ApiKeyManagerProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

// A simple, low-cost validation method
const validateApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey) return false;
    try {
        const provider = new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${apiKey}`);
        await provider.getBlockNumber(); // Simple, quick request
        return true;
    } catch (error) {
        console.warn("Infura API key validation failed:", error);
        return false;
    }
};

export default function ApiKeyManager({ isOpen, onOpenChange }: ApiKeyManagerProps) {
  const { infuraApiKey, setInfuraApiKey, isInitialized } = useWallet();
  const [keyInput, setKeyInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && infuraApiKey) {
      // Don't display the full key, just an indicator
      setKeyInput(`••••••••${infuraApiKey.slice(-4)}`);
    } else {
      setKeyInput('');
    }
  }, [isInitialized, infuraApiKey]);

  const handleSave = async () => {
    if (!keyInput) return;

    setIsValidating(true);
    setError(null);

    const isValid = await validateApiKey(keyInput);

    setIsValidating(false);

    if (isValid) {
      setInfuraApiKey(keyInput);
      onOpenChange(false);
    } else {
      setError("Invalid API key. Please check and try again.");
      setTimeout(() => {
          setError(null);
          setKeyInput('');
      }, 2000); // Clear input after showing error
    }
  };

  const handleClear = () => {
    setInfuraApiKey(null); // This will remove it from localStorage
    setKeyInput('');
    setError(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] bg-background"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Manage API Keys</SheetTitle>
          <SheetDescription>
            Provide and manage your personal Infura API key to connect to blockchain networks.
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
            <div className="relative">
                <Input
                  id="infura-key"
                  type={infuraApiKey ? "password" : "text"}
                  placeholder="Paste your Infura API key here"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  readOnly={!!infuraApiKey}
                  className={cn(error && "ring-2 ring-destructive ring-offset-2 ring-offset-background")}
                />
                {infuraApiKey && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={handleClear}
                    >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          
          {!infuraApiKey && (
            <Button onClick={handleSave} className="w-full" disabled={isValidating || !keyInput}>
              {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and Use Key
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
