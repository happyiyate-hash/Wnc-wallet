
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
  
  // PEEK STATE: Allows user to hide/show the banner during scan
  const [isManuallyHidden, setIsManuallyHidden] = useState(false);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    // 1. DESKTOP HANDSHAKE (Double Click)
    const handleDblClick = () => {
      setIsManuallyHidden(prev => !prev);
    };

    // 2. MOBILE HANDSHAKE (Double Tap)
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

  const verticalFadeVariants = {
    initial: { y: 15, opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { type: 'spring', damping: 20, stiffness: 200 } },
    exit: { y: -15, opacity: 0, transition: { duration: 0.2 } }
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
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={cn(
        "fixed top-12 left-4 right-4 z-[100] max-w-md mx-auto",
        isManuallyHidden ? "pointer-events-none" : "pointer-events-auto"
      )}
    >
      <div className={cn(
        "backdrop-blur-2xl border rounded-[1.5rem] p-4 shadow-2xl relative overflow-visible transition-colors duration-500",
        isMismatch ? "bg-red-500/10 border-red-500/20" : "bg-[#0a0a0c]/95 border-white/10"
      )}>
        
        {/* HEADER SECTION (Top Side) */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500",
              (status === 'success' || status === 'completed') ? "bg-green-500/10" : isMismatch ? "bg-red-500/20" : "bg-white/5"
            )}>
              {renderStatusIcon()}
            </div>
            <div className="flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-widest text-white leading-none">Cloud Sync Node</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1 h-1 rounded-full bg-primary" />
                <p className="text-[8px] font-black uppercase text-white/40 tracking-widest">Hardware Identity Handshake</p>
              </div>
            </div>
          </div>
          
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
            <Zap className="w-3 h-3 text-primary fill-primary" />
            <span className="text-[9px] font-black uppercase text-white tracking-widest">
              {chain || 'Vault'}
            </span>
          </div>
        </div>

        {/* PROGRESS SECTION (Middle) */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between items-center px-1">
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest transition-colors duration-300",
              isMismatch ? "text-red-500 animate-pulse" : "text-primary"
            )}>
              Scanning {chain || 'Vault Registry'}...
            </span>
            <span className="text-[9px] font-black text-white/40 uppercase">{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ 
                width: `${progress}%`,
                backgroundColor: isMismatch ? '#ef4444' : '#8b5cf6' 
              }}
              transition={{ duration: 0.3 }}
              className="h-full shadow-[0_0_8px_rgba(var(--primary),0.5)]"
            />
          </div>
        </div>

        {/* DATA SLOTS (Bottom Cards) - SLIM MODE (h-14) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative h-14">
            <AnimatePresence mode="popLayout">
              <motion.div 
                key={`${chain}-cloud`}
                variants={verticalFadeVariants}
                initial="initial" animate="animate" exit="exit"
                className="h-full w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-center gap-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <Database className="w-2.5 h-2.5 text-white/40" />
                  <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Cloud Registry</span>
                </div>
                <div className="relative inline-block overflow-hidden">
                  <p className={cn(
                    "text-[10px] font-mono font-bold transition-colors duration-300",
                    isMismatch ? "text-red-400" : "text-white/60"
                  )}>
                    {truncateAddress(cloudValue)}
                  </p>
                  {isMismatch && (
                    <motion.div 
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      className="absolute top-1/2 left-0 right-0 h-[1px] bg-red-500 origin-left"
                    />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative h-14">
            <AnimatePresence mode="popLayout">
              <motion.div 
                key={`${chain}-local`}
                variants={verticalFadeVariants}
                initial="initial" animate="animate" exit="exit"
                className="h-full w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-center gap-0.5 relative overflow-visible"
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

      </div>
    </motion.div>
  );
}
