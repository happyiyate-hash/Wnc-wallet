
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const { toast } = useToast();
  
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.length !== 6) return;

    setIsLoading(true);
    try {
      const { error } = await supabase!.auth.verifyOtp({
        email,
        token: code,
        type: 'signup'
      });

      if (error) throw error;

      toast({ title: "Email Verified!", description: "Let's set up your profile." });
      router.push('/complete-profile');
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Verification Failed", 
        description: error.message 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setIsResending(true);
    try {
      const { error } = await supabase!.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      toast({ title: "Code Resent", description: "Check your inbox again." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] p-6 text-foreground">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8 text-center"
      >
        <div className="space-y-2">
          <div className="w-20 h-20 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 text-primary shadow-2xl shadow-primary/20">
            <Mail className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Verify Email</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We've sent a 6-digit code to <br/>
            <span className="text-white font-bold">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="space-y-4">
            <Input 
              type="text" 
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              className="h-16 bg-white/5 border-white/10 rounded-2xl text-center text-3xl font-mono tracking-[0.5em] focus-visible:ring-primary focus-visible:border-primary"
              required
            />
            <div className="flex justify-center">
              <Button 
                type="button" 
                variant="link" 
                onClick={handleResend}
                disabled={isResending}
                className="text-primary font-bold text-xs uppercase tracking-widest"
              >
                {isResending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                Resend Code
              </Button>
            </div>
          </div>

          <Button 
            type="submit"
            className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
            disabled={isLoading || code.length !== 6}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Identity"}
          </Button>
        </form>

        <div className="pt-8 flex items-center justify-center gap-2 opacity-20">
          <ShieldCheck className="w-3 h-3 text-white" />
          <span className="text-[8px] font-black uppercase tracking-widest text-white">Institutional Security Protocol</span>
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-[#050505]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
