
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Check, X, SendHorizonal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import TokenLogoDynamic from '../shared/TokenLogoDynamic';
import { cn } from '@/lib/utils';

interface TransactionStatusCardProps {
  isVisible: boolean;
  status: 'pending' | 'success' | 'error';
  senderAvatar?: string;
  senderName: string;
  recipientAvatar?: string;
  recipientName: string;
  token?: {
    symbol: string;
    iconUrl?: string | null;
    chainId: number;
    name?: string;
  };
  isRawAddress?: boolean;
}

/**
 * TRANSACTION STATUS CARD
 * Positioned fixed at the top with a high-priority z-index (z-[500]) 
 * to ensure money-sending animations are always visible during handshakes.
 */
export default function TransactionStatusCard({
  isVisible,
  status,
  senderAvatar,
  senderName,
  recipientAvatar,
  recipientName,
  token,
  isRawAddress
}: TransactionStatusCardProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          className="fixed top-4 left-4 right-4 z-[500] max-w-lg mx-auto"
        >
          <div className="bg-[#0a0a0c]/90 backdrop-blur-2xl border border-primary/20 rounded-[2rem] p-4 shadow-2xl overflow-hidden relative">
            {/* Background Glows */}
            <div className={cn(
              "absolute -right-10 -top-10 w-32 h-32 blur-3xl transition-colors duration-1000",
              status === 'success' ? "bg-green-500/20" : status === 'error' ? "bg-red-500/20" : "bg-primary/10"
            )} />

            <div className="flex items-center justify-between relative z-10">
              {/* SENDER NODE */}
              <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
                <div className="relative">
                  {status === 'pending' && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-1.5 border-2 border-dashed border-primary/40 rounded-full"
                    />
                  )}
                  <Avatar className="w-10 h-10 border border-white/10 rounded-full">
                    <AvatarImage src={senderAvatar} alt="Sender" />
                    <AvatarFallback className="bg-primary/20 text-primary font-black text-[10px]">
                      {senderName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-0.5 border border-white/10 shadow-xl z-20">
                    <TokenLogoDynamic 
                      logoUrl={token?.iconUrl} 
                      size={14} 
                      chainId={token?.chainId} 
                      symbol={token?.symbol} 
                      name={token?.name}
                      alt="token badge"
                    />
                  </div>
                </div>
                <span className="text-[8px] font-black text-white/40 uppercase tracking-widest truncate w-16 text-center">
                  {senderName}
                </span>
              </div>

              {/* FLIGHT PATH */}
              <div className="flex-1 flex flex-col items-center justify-center px-4">
                <div className="w-full relative h-6">
                  {/* Dashed Line */}
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] border-t border-dashed border-white/10 -translate-y-1/2" />
                  
                  {/* Message Projectile */}
                  <motion.div
                    animate={
                      status === 'pending' 
                        ? { x: [-20, 80], opacity: [0, 1, 1, 0] }
                        : status === 'success'
                        ? { x: 80, opacity: 0 }
                        : { opacity: 0 }
                    }
                    transition={
                      status === 'pending' 
                        ? { duration: 1.2, repeat: Infinity, ease: "linear" }
                        : { duration: 0.3 }
                    }
                    className="absolute top-1/2 left-0 -translate-y-1/2 text-primary"
                  >
                    <SendHorizonal className="w-4 h-4 fill-primary" />
                  </motion.div>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className={cn(
                    "text-[7px] font-black uppercase tracking-[0.2em] animate-pulse",
                    status === 'success' ? "text-green-500" : status === 'error' ? "text-red-500" : "text-primary"
                  )}>
                    {status === 'pending' ? 'Broadcasting...' : status === 'success' ? 'Confirmed' : 'System Error'}
                  </span>
                </div>
              </div>

              {/* RECIPIENT NODE */}
              <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
                <div className="relative">
                  <motion.div
                    animate={status === 'success' ? { scale: [1, 1.1, 1], boxShadow: "0 0 20px #8b5cf6" } : {}}
                    className={cn(
                      "w-10 h-10 rounded-full border border-white/10 flex items-center justify-center overflow-hidden transition-all duration-500 bg-black/40",
                      status === 'success' && "border-primary/50"
                    )}
                  >
                    {isRawAddress ? (
                      <TokenLogoDynamic 
                        logoUrl={token?.iconUrl} 
                        size={28} 
                        chainId={token?.chainId} 
                        symbol={token?.symbol} 
                        name={token?.name}
                        alt="target token"
                      />
                    ) : (
                      <Avatar className="w-full h-full rounded-none">
                        <AvatarImage src={recipientAvatar} alt="Recipient" />
                        <AvatarFallback className="bg-primary/20 text-primary font-black text-[10px]">
                          {recipientName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </motion.div>

                  {/* Token Badge for Recipient */}
                  <div className="absolute -bottom-1 -right-1 bg-black rounded-lg p-0.5 border border-white/10 shadow-xl z-20">
                    <TokenLogoDynamic 
                      logoUrl={token?.iconUrl} 
                      size={14} 
                      chainId={token?.chainId} 
                      symbol={token?.symbol} 
                      name={token?.name}
                      alt="token badge"
                    />
                  </div>

                  {/* Status Badge */}
                  <AnimatePresence>
                    {status !== 'pending' && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn(
                          "absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0a0a0c] text-white shadow-xl z-[30]",
                          status === 'success' ? "bg-green-500" : "bg-red-500"
                        )}
                      >
                        {status === 'success' ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <span className="text-[8px] font-black text-white/40 uppercase tracking-widest truncate w-16 text-center">
                  {recipientName}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
