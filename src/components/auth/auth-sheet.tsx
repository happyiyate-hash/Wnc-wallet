'use client';

import { useState } from 'react';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AuthSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function AuthSheet({ isOpen, onOpenChange }: AuthSheetProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setIsLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Successfully logged in." });
      } else {
        const { error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    username: email.split('@')[0],
                }
            }
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Please check your email for a verification link." });
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Authentication Error", 
        description: error.message 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-[2rem] bg-[#121218] border-t border-white/10 p-6 pt-4 pb-8 max-h-[380px] overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center space-y-1 mb-4">
          <h2 className="text-lg font-extrabold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            {mode === 'login' ? 'Login' : 'Join Wevina'}
          </h2>
        </div>

        <div className="bg-[#1c1c24] p-1 rounded-2xl flex mb-4">
          <button 
            onClick={() => setMode('login')}
            className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                mode === 'login' ? "bg-black text-white shadow-lg" : "text-muted-foreground"
            )}
          >
            Login
          </button>
          <button 
            onClick={() => setMode('signup')}
            className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                mode === 'signup' ? "bg-black text-white shadow-lg" : "text-muted-foreground"
            )}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-3">
          <div className="space-y-1">
            <Input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-[#1c1c24] border-none rounded-xl text-white placeholder:text-zinc-600 focus-visible:ring-primary text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <Input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 bg-[#1c1c24] border-none rounded-xl text-white placeholder:text-zinc-600 focus-visible:ring-primary text-sm"
              required
            />
          </div>

          <Button 
            type="submit"
            className="w-full h-12 rounded-xl text-base font-bold bg-primary hover:bg-primary/90 transition-transform active:scale-[0.98] mt-2"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : (mode === 'login' ? 'Login' : 'Get Started')}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
