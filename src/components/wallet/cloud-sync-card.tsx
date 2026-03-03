'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  CheckCircle2, 
  RefreshCw, 
  Cpu
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';

export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;

  if (status === 'idle') return null;

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    if (addr === 'Stored' || addr === 'Missing' || addr === 'Encrypted Phrase') return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // NEW PREMIUM ANIMATION: Vertical Fade (No more horizontal ghosting)
  const verticalFadeVariants = {
    initial: { y: 15, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { type: 'spring', damping: 20, stiffness: 200 } },
    exit: { y: -15, opacity: 0, transition: { duration: 0.2 } }
  };

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-12 left-4 right-4 z-[100] max-w-md mx-auto"
    >
      {/* MAIN CONTAINER: Reduced height to be SLIM like a Swap Card */}
      <div className="bg-[#0a0a0c]/95 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] p-4 shadow-2xl relative overflow-visible">
        
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <RefreshCw className={cn("w-4 h-4 text-primary", status === 'syncing' && "animate-spin")} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/80">Cloud Sync Node</h3>
          </div>
          <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-primary">
            {chain || 'Network'}
          </div>
        </div>

        {/* DATA SLOTS: Two separate, independent cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          
          {/* SLOT 1: CLOUD */}
          <div className="relative h-14">
            <AnimatePresence mode="wait">
              <motion.div 
                key={`${chain}-cloud`}
                variants={verticalFadeVariants}
                initial="initial" animate="animate" exit="exit"
                className="h-full w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-center"
              >
                <div className="flex items-center gap-1 mb-1">
                  <Database className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-[7px] font-bold text-muted-foreground uppercase">Cloud Registry</span>
                </div>
                <p className="text-[10px] font-mono text-white/60 truncate">{truncateAddress(cloudValue)}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* SLOT 2: LOCAL + PREMIUM BADGE */}
          <div className="relative h-14">
            <AnimatePresence mode="wait">
              <motion.div 
                key={`${chain}-local`}
                variants={verticalFadeVariants}
                initial="initial" animate="animate" exit="exit"
                className="h-full w-full p-2.5 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-center relative overflow-visible"
              >
                <div className="flex items-center gap-1 mb-1">
                  <Cpu className="w-2.5 h-2.5 text-primary" />
                  <span className="text-[7px] font-bold text-primary uppercase">Local Node</span>
                </div>
                <p className="text-[10px] font-mono text-white truncate">{truncateAddress(localValue)}</p>

                {/* THE BADGE: Half-in, Half-out Premium Checkmark */}
                {(status === 'success' || status === 'completed') && (
                  <motion.div 
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute -top-1.5 -right-1.5 z-20"
                  >
                    <div className="bg-black rounded-full p-0.5 border border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 fill-black" />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Progress Bar: Slim line at the bottom */}
        <div className="space-y-1">
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]"
            />
          </div>
          <div className="flex justify-between items-center text-[8px] font-black uppercase text-muted-foreground tracking-tighter">
            <span>{status}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
