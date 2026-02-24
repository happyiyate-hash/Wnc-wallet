'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function SwapPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-black uppercase tracking-widest">Swap</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-muted-foreground">Swap design cleared. Waiting for your specific design code.</p>
      </main>
    </div>
  );
}
