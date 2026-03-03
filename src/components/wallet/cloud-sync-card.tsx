'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  CheckCircle2, 
  RefreshCw, 
  Cpu,
  Search,
  AlertCircle,
  Zap
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-provider';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

export default function CloudSyncCard() {
  const { syncDiagnostic } = useWallet();
  const { status, chain, localValue, cloudValue, progress } = syncDiagnostic;
  
  const [isManuallyHidden, setIsManuallyHidden] = useState(false);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    const handleDblClick = () => {
      setIsManuallyHidden(prev => !prev);
    };

    const handleTouchStart = () => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        setIsManuallyHidden(prev => !prev);
      }
      lastTapRef.current = now;
    };

    window.addEventListener('dblclick', handleDblClick);
    window.addEventListener('touchstart', handleTouchStart);

    return () => {
      window.removeEventListener('dblclick', handleDblClick);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  if (status === 'idle') return null;

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'None';
    if (addr === 'Stored' || addr === 'Missing' || addr === 'Encrypted Phrase') return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // SMOTHED TRANSITIONS: Increased spring damping and slightly longer durations
  const verticalFadeVariants = {
    initial: { y: 15, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 150 } },
    exit: { y: -15, opacity: 0, transition: { duration: 0.4 } }
  };

  const renderStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Search className="w-4 h-4 text-white/80" />;
      case 'mismatch':
        return <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-primary animate-spin" />;
      case 'success':
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-primary" />;
    }
  };

  const isMismatch = status === 'mismatch';

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ 
        y: isManuallyHidden ? -250 : 0, 
        opacity: isManuallyHidden ? 0 : 1 
      }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 150 }}
      className={cn(
        "fixed top-4 left-4 right-4 z-[100] max-w-lg mx-auto",
        isManuallyHidden ? "pointer-events-none" : "pointer-events-auto"
      )}
    >
      <div className={cn(
        "backdrop-blur-3xl border rounded-[1.5rem] p-4 shadow-2xl relative overflow-visible transition-colors duration-700",
        isMismatch ? "bg-red-500/10 border-red-500/20" : "bg-[#0a0a0c]/95 border-white/10"
      )}>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-700",
              (status === 'success' || status === 'completed') ? "bg-green-500/10" : isMismatch ? "bg-red-500/20" : "bg-white/5"
            )}>
              {renderStatusIcon()}
            </div>
            <div className="flex flex-col">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white leading-none">Cloud Sync Node</h3>
              <p className="text-[7px] font-black uppercase text-white/40 tracking-widest mt-1">Hardware Handshake</p>
            </div>
          </div>
          
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
            <Zap className="w-3 h-3 text-primary fill-primary" />
            <span className="text-[9px] font-black uppercase text-white tracking-widest">
              {chain || 'Registry'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="relative h-14">
            <AnimatePresence mode="wait">
              <motion.div 
                key={`${chain}-cloud`}
                variants={verticalFadeVariants}
                initial="initial" animate="animate" exit="exit"
                className="h-full w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-center gap-0.5 relative overflow-hidden"
              >
                <div className="flex items-center gap-1.5">
                  <Database className="w-2.5 h-2.5 text-white/40" />
                  <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Cloud Registry</span>
                </div>
                <div className="relative inline-block">
                  <p className={cn(
                    "text-[10px] font-mono font-bold transition-colors duration-500",
                    isMismatch ? "text-red-400" : "text-white/60"
                  )}>
                    {truncateAddress(cloudValue)}
                  </p>
                  
                  <AnimatePresence>
                    {isMismatch && (
                      <motion.div 
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        exit={{ scaleX: 0 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-red-500 origin-left z-10"
                      />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative h-14">
            <AnimatePresence mode="wait">
              <motion.div 
                key={`${chain}-local`}
                variants={verticalFadeVariants}
                initial="initial" animate="animate" exit="exit"
                className="h-full w-full p-2.5 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-center gap-0.5 relative overflow-visible"
              >
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-2.5 h-2.5 text-primary" />
                  <span className="text-[7px] font-black text-primary uppercase tracking-widest">Local Node</span>
                </div>
                <p className="text-[10px] font-mono font-bold text-white truncate">{truncateAddress(localValue)}</p>

                {(status === 'success' || status === 'completed') && (
                  <motion.div 
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="absolute -top-1 -right-1 z-20"
                  >
                    <div className="bg-black rounded-full p-0.5 border border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                      <CheckCircle2 className="w-2.5 h-2.5 text-green-500 fill-black" />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ 
                width: `${progress}%`,
                backgroundColor: isMismatch ? '#ef4444' : '#8b5cf6' 
              }}
              transition={{ duration: 0.6 }} // Slower, smoother progress bar
              className="h-full shadow-[0_0_8px_rgba(var(--primary),0.5)]"
            />
          </div>
          <div className="flex justify-between items-center px-1">
            <span className={cn(
              "text-[8px] font-black uppercase tracking-widest transition-colors duration-500",
              isMismatch ? "text-red-500" : "text-muted-foreground"
            )}>
              {isMismatch ? 'REGISTRY MISMATCH DETECTED' : status}
            </span>
            <span className="text-[8px] font-black text-white/40 uppercase">{Math.round(progress)}%</span>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
