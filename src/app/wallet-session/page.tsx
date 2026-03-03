
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ShieldCheck, 
  Lock, 
  CloudDownload, 
  Plus, 
  Download, 
  Timer, 
  AlertCircle,
  Zap,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export default function WalletSessionPage() {
  const { generateWallet, importWallet, restoreFromCloud, wallets } = useWallet();
  const { profile, user, refreshProfile } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<'options' | 'import'>('options');
  const [importInput, setImportInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);

  const startTimer = () => {
    setTimer(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimer(Date.now() - startTimeRef.current);
    }, 10);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  /**
   * INSTITUTIONAL REFERRAL HANDSHAKE
   * Finalizes the invitation link by creating a permanent entry in the 'referrals' registry.
   */
  const finalizeReferral = async (newUserId: string) => {
    if (!supabase) return;
    
    // 1. Capture referral metadata from user account
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const refCode = currentUser?.user_metadata?.referral_code;
    
    if (!refCode) return;

    try {
      // 2. Resolve Referrer Node by Account ID suffix
      const { data: referrer, error: fetchErr } = await supabase
        .from('profiles')
        .select('id')
        .ilike('account_number', `%${refCode}`)
        .maybeSingle();

      if (fetchErr || !referrer || referrer.id === newUserId) return;

      // 3. Prevent duplicate handshakes
      const { data: existing } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_id', newUserId)
        .maybeSingle();

      if (existing) return;

      // 4. Authorize 100 WNC Escrow Node
      await supabase.from('referrals').insert({
        referrer_id: referrer.id,
        referred_id: newUserId,
        status: 'pending',
        reward_amount: 100
      });

      console.log("[REFERRAL_HANDSHAKE_SUCCESS]");
    } catch (e) {
      console.warn("[REFERRAL_HANDSHAKE_FAIL]", e);
    }
  };

  const finishOnboarding = async () => {
    if (!user || !supabase) {
        router.push('/');
        return;
    }
    
    setIsProcessing(true);
    setStatus('Finalizing Node...');
    
    try {
      // Step A: Link referral node if applicable
      await finalizeReferral(user.id);

      // Step B: Mark profile as active in registry
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        
      if (dbError) {
          console.warn("Onboarding flag advisory:", dbError.message);
      }

      await refreshProfile();
      router.push('/');
    } catch (e) {
      console.error("ONBOARDING_FINISH_ERROR:", e);
      router.push('/');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreate = async () => {
    setIsProcessing(true);
    setError(null);
    setStatus('Deriving Nodes...');
    startTimer();
    try {
      await generateWallet();
      setStatus('Complete!');
      setTimeout(finishOnboarding, 800);
    } catch (e: any) {
      console.error("GEN_ERROR:", e);
      setError(e.message || "Generation failed.");
      setIsProcessing(false);
      stopTimer();
    }
  };

  const handleImport = async () => {
    if (!importInput.trim()) return;
    setIsProcessing(true);
    setError(null);
    setStatus('Syncing Mnemonic...');
    startTimer();
    try {
      await importWallet(importInput);
      setStatus('Complete!');
      setTimeout(finishOnboarding, 800);
    } catch (e: any) {
      console.error("IMPORT_ERROR:", e);
      setStatus('Invalid Node');
      setError("Please verify your 12 or 24 word recovery phrase.");
      setIsProcessing(false);
      stopTimer();
    }
  };

  const handleRestore = async () => {
    setIsProcessing(true);
    setError(null);
    setStatus('Connecting to Cloud...');
    startTimer();
    try {
      await restoreFromCloud(setStatus);
      setStatus('Access Restored!');
      setTimeout(finishOnboarding, 800);
    } catch (e: any) {
      console.error("RESTORE_ERROR:", e);
      setStatus('No Backup Found');
      setError(e.message || "Failed to locate cloud credentials.");
      setIsProcessing(false);
      stopTimer();
    }
  };

  const hasCloudBackup = !!(profile?.vault_phrase);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent p-6 text-foreground relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] -mr-64 -mt-64 rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-sm space-y-10 relative z-10"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 border border-primary/20 text-primary shadow-2xl">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Establish Vault</h1>
          <div className="flex flex-col items-center gap-1">
            {isProcessing ? (
              <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-tighter animate-pulse">
                <Timer className="w-3 h-3" />
                {(timer / 1000).toFixed(3)}s | {status}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground uppercase font-bold tracking-widest opacity-60">Manage your institutional keys</p>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'options' ? (
            <motion.div key="options" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 mb-4 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-400 leading-relaxed font-medium">{error}</p>
                </div>
              )}

              <button 
                onClick={handleCreate}
                disabled={isProcessing}
                className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-black/40 backdrop-blur-xl border border-primary/20 hover:bg-primary/20 transition-all group active:scale-[0.98] shadow-2xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white uppercase tracking-tight">Create New Node</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">Generate 12-word phrase</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
              </button>

              <button 
                onClick={() => setStep('import')}
                disabled={isProcessing}
                className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-black/40 backdrop-blur-xl border border-white/5 hover:bg-white/10 transition-all group active:scale-[0.98] shadow-2xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground group-hover:scale-110 transition-transform">
                    <Download className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white uppercase tracking-tight">Import Existing</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest font-black opacity-60">Manual Phrase Entry</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground opacity-20 group-hover:opacity-60 transition-opacity" />
              </button>

              <button 
                onClick={handleRestore}
                disabled={isProcessing || !hasCloudBackup}
                className={cn(
                  "w-full flex items-center justify-between p-6 rounded-[2rem] bg-gradient-to-br from-emerald-500/20 to-transparent backdrop-blur-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all group active:scale-[0.98] shadow-2xl",
                  !hasCloudBackup && "opacity-40 grayscale pointer-events-none"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                    <CloudDownload className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white uppercase tracking-tight">Cloud Recovery</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">Encrypted Registry Retrieval</p>
                  </div>
                </div>
                {hasCloudBackup && <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />}
              </button>
            </motion.div>
          ) : (
            <motion.div key="import" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2">Secret Phrase</Label>
                <Textarea 
                  placeholder="Enter your 12 or 24 word mnemonic phrase here..."
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  className="min-h-[120px] bg-black/40 backdrop-blur-xl border-white/10 rounded-[2rem] p-5 text-sm leading-relaxed focus-visible:ring-primary text-white shadow-2xl"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold uppercase tracking-widest text-xs" onClick={() => { setStep('options'); setError(null); }}>Back</Button>
                <Button 
                  className="flex-[2] h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary shadow-xl shadow-primary/20"
                  onClick={handleImport}
                  disabled={!importInput.trim() || isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authorize Import"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-8 flex flex-col items-center gap-3 opacity-20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white">Registry Integrity Handshake v2.1</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
