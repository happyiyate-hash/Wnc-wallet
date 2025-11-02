'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/wallet-provider';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Loader2, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import { cn } from '@/lib/utils';

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

export default function ApiKeysPage() {
  const { infuraApiKey, setInfuraApiKey } = useWallet();
  const router = useRouter();
  const [keyInput, setKeyInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (infuraApiKey) {
      setKeyInput(`••••••••${infuraApiKey.slice(-4)}`);
    } else {
      setKeyInput('');
    }
  }, [infuraApiKey]);

  const handleSave = async () => {
    if (!keyInput || (infuraApiKey && keyInput.startsWith('••••••••'))) {
      return;
    }

    setIsValidating(true);
    setError(null);

    const isValid = await validateApiKey(keyInput);

    setIsValidating(false);

    if (isValid) {
      setInfuraApiKey(keyInput);
      router.push('/'); // Go back to wallet after saving
    } else {
      setError("Invalid API key. Please check and try again.");
      setTimeout(() => {
          setError(null);
          setKeyInput('');
      }, 2000);
    }
  };

  const handleClear = () => {
    setInfuraApiKey(null);
    setKeyInput('');
    setError(null);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyInput(e.target.value);
    if (error) setError(null);
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 flex items-center gap-2 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Manage API Keys</h1>
      </header>
      <main className="flex-1 p-4 space-y-6">
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
                  type="text"
                  placeholder="Paste your Infura API key here"
                  value={keyInput}
                  onChange={handleInputChange}
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
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
          
        <Button onClick={handleSave} className="w-full" disabled={isValidating || !keyInput || (infuraApiKey && keyInput.startsWith('••••••••'))}>
          {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {infuraApiKey ? 'Update Key' : 'Save and Use Key'}
        </Button>
      </main>
    </div>
  );
}
