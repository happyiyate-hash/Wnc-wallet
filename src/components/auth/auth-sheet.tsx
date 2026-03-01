'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { Loader2, Zap, Users, ShieldCheck } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useSearchParams } from 'next/navigation';

interface AuthSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function AuthSheet({ isOpen, onOpenChange }: AuthSheetProps) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
        setReferralCode(ref.toUpperCase());
        setMode('signup');
    }
  }, [searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setIsLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!" });
      } else {
        const { error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    username: email.split('@')[0],
                    referral_code: referralCode.trim() || null,
                    signup_date: new Date().toISOString()
                }
            }
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Please verify your email." });
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
        className="rounded-t-[2.5rem] bg-[#121218] border-t border-white/10 p-5 pb-8 h-auto max-h-[90vh] overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-extrabold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent text-center">
            {mode === 'login' ? 'Login' : 'Join Wevina'}
          </SheetTitle>
        </SheetHeader>

        {referralCode && mode === 'signup' && (
            <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3 animate-in slide-in-from-top-2">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                    <Zap className="w-5 h-5 fill-current" />
                </div>
                <div className="text-left">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Protocol Bonus Active</p>
                    <p className="text-xs font-bold text-white/80">Joining via Node: <span className="text-white underline">{referralCode}</span></p>
                </div>
            </div>
        )}

        <div className="bg-[#1c1c24] p-1 rounded-2xl flex mb-4 max-w-[280px] mx-auto">
          <button 
            type="button"
            onClick={() => setMode('login')}
            className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                mode === 'login' ? "bg-black text-white shadow-lg" : "text-muted-foreground"
            )}
          >
            Login
          </button>
          <button 
            type="button"
            onClick={() => setMode('signup')}
            className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                mode === 'signup' ? "bg-black text-white shadow-lg" : "text-muted-foreground"
            )}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-3 max-w-[320px] mx-auto">
          <Input 
            type="email" 
            placeholder="Email address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-[#1c1c24] border-none rounded-xl text-white placeholder:text-zinc-600 focus-visible:ring-primary text-sm"
            required
          />
          <Input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 bg-[#1c1c24] border-none rounded-xl text-white placeholder:text-zinc-600 focus-visible:ring-primary text-sm"
            required
          />

          {mode === 'signup' && (
            <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                    <Users className="w-4 h-4" />
                </div>
                <Input 
                    placeholder="Referral Code (Optional)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="h-11 bg-[#1c1c24] border-none rounded-xl text-white pl-10 placeholder:text-zinc-700 focus-visible:ring-primary text-xs font-mono tracking-widest"
                />
            </div>
          )}

          <Button 
            type="submit"
            className="w-full h-12 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 transition-transform active:scale-[0.98] mt-2 shadow-xl shadow-primary/20"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : (mode === 'login' ? 'Login' : 'Initialize Node')}
          </Button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-2 opacity-20">
            <ShieldCheck className="w-3 h-3" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white">Secured by Master Wevina Protocol</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
