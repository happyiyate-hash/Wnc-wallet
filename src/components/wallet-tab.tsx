"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Check, RefreshCw, AlertTriangle, Send } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useToast } from "@/hooks/use-toast";

// Helper function to generate a mock address/key
const generateRandomString = (length = 42) => {
  const chars = '0123456789abcdef';
  let result = '0x';
  for (let i = length - 2; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
};

interface WalletState {
  address: string | null;
  privateKey: string | null;
  balance: number;
}

export default function WalletTab() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    privateKey: null,
    balance: 0,
  });
  const [isAddressCopied, copyAddress] = useCopyToClipboard();
  const [isKeyCopied, copyKey] = useCopyToClipboard();
  const { toast } = useToast();

  const handleGenerateWallet = () => {
    setWallet({
      address: generateRandomString(),
      privateKey: generateRandomString(64),
      balance: 10, // Give some mock balance
    });
    toast({
      title: "Wallet Generated",
      description: "Your new wallet is ready. Secure your private key!",
    });
  };

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    const recipient = formData.get('recipient') as string;

    if (isNaN(amount) || amount <= 0) {
        toast({
            title: "Invalid Amount",
            description: "Please enter a valid amount to send.",
            variant: "destructive",
        });
        return;
    }

    if (!wallet.address || wallet.balance < amount) {
        toast({
            title: "Transaction Failed",
            description: "Insufficient funds.",
            variant: "destructive",
        });
        return;
    }
    
    setWallet(prev => ({ ...prev, balance: prev.balance - amount }));
    
    toast({
        title: "Transaction Sent!",
        description: `Successfully sent ${amount} ETH to ${recipient.slice(0,10)}...`,
    });
    (e.target as HTMLFormElement).reset();
  };

  if (!wallet.address) {
    return (
      <Card className="mt-6 shadow-lg border-none">
        <CardContent className="pt-6 flex flex-col items-center justify-center text-center h-80">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <RefreshCw className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl mb-4">Create Your Wallet</CardTitle>
          <CardDescription className="mb-6 max-w-sm">
            Generate a new secure wallet to start managing your crypto assets. Your keys stay on your device.
          </CardDescription>
          <Button size="lg" onClick={handleGenerateWallet} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Generate New Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <Card className="shadow-lg border-none">
        <CardHeader>
          <CardTitle>My Wallet</CardTitle>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground font-mono">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</p>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyAddress(wallet.address || '')}>
                {isAddressCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
             <Label className="text-muted-foreground">Balance</Label>
             <p className="text-4xl font-bold tracking-tight">{wallet.balance.toFixed(4)} ETH</p>
          </div>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important: Secure Your Private Key!</AlertTitle>
            <AlertDescription>
              Store this key in a safe, offline location. Anyone with this key can access your funds. We cannot recover it for you.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="privateKey">Private Key</Label>
            <div className="flex items-center gap-2">
              <Input id="privateKey" readOnly value={wallet.privateKey} type="password" className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => copyKey(wallet.privateKey || '')}>
                 {isKeyCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-none">
        <CardHeader>
          <CardTitle>Send Crypto</CardTitle>
          <CardDescription>Transfer funds to another wallet.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSend}>
            <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input id="recipient" name="recipient" placeholder="0x..." required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="amount">Amount (ETH)</Label>
                <Input id="amount" name="amount" type="number" step="0.0001" placeholder="0.0" required />
            </div>
            </CardContent>
            <CardFooter>
            <Button type="submit" className="w-full sm:w-auto ml-auto">
                <Send className="mr-2 h-4 w-4" />
                Send
            </Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
