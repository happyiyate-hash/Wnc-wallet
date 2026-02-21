'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { Loader2, Github } from 'lucide-react';
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

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    if (!supabase) return;
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    } catch (error: any) {
        toast({ variant: "destructive", title: "Social Login Failed", description: error.message });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-[2.5rem] bg-[#121218] border-t border-white/10 p-8 max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center space-y-2 mb-8">
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            Welcome to Wevina v2
          </h2>
          <p className="text-muted-foreground text-sm max-w-[250px]">
            Join the programmable non-custodial wallet platform.
          </p>
        </div>

        <div className="bg-[#1c1c24] p-1 rounded-2xl flex mb-8">
          <button 
            onClick={() => setMode('login')}
            className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                mode === 'login' ? "bg-black text-white shadow-lg" : "text-muted-foreground"
            )}
          >
            Login
          </button>
          <button 
            onClick={() => setMode('signup')}
            className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                mode === 'signup' ? "bg-black text-white shadow-lg" : "text-muted-foreground"
            )}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Input 
              type="email" 
              placeholder="email@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 bg-[#1c1c24] border-none rounded-2xl text-white placeholder:text-zinc-600 focus-visible:ring-primary"
              required
            />
          </div>
          <div className="space-y-2">
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 bg-[#1c1c24] border-none rounded-2xl text-white placeholder:text-zinc-600 focus-visible:ring-primary"
              required
            />
          </div>

          <Button 
            type="submit"
            className="w-full h-14 rounded-2xl text-lg font-bold bg-primary hover:bg-primary/90 transition-transform active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : (mode === 'login' ? 'Login' : 'Create Account')}
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
            <span className="bg-[#121218] px-4 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div className="flex justify-center">
            <button 
                onClick={() => handleSocialLogin('github')}
                className="w-14 h-14 rounded-full bg-destructive/20 border border-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive/30 transition-colors"
            >
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black font-black text-xl">
                    N
                </div>
            </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
