
'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Bell, Loader2, X, CheckCircle2, Zap, ArrowDownLeft, ArrowUpRight, QrCode, Workflow, HandCoins } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import type { Notification } from '@/lib/types';

/**
 * INSTITUTIONAL NOTIFICATION CENTER (VIEW NODE)
 * Version: 9.0.0 (Zero-Latency UI)
 * 
 * Uses the global notifications state from WalletProvider for instant rendering.
 * Handlers trigger background "Mark as Read" handshakes.
 */
export default function NotificationCenter() {
  const { isNotificationsOpen, setIsNotificationsOpen, setUnreadCount, notifications, setNotifications, isNotificationsLoaded } = useWallet();
  const { user } = useUser();
  const hasMarkedReadRef = useRef(false);

  // Mark all as read when opening
  useEffect(() => {
    if (isNotificationsOpen && user && supabase && notifications.length > 0) {
      const markAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;

        // 1. Local Optimistic Update
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);

        // 2. Persistent Registry Handshake
        try {
          await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
        } catch (e) {
          console.warn("[REGISTRY] Mark as read failed.");
        }
      };

      markAsRead();
    }
  }, [isNotificationsOpen, user, notifications, setNotifications, setUnreadCount]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'TRANSFER_IN':
      case 'REWARD':
        return <ArrowDownLeft className="w-5 h-5" />;
      case 'TRANSFER_OUT':
        return <ArrowUpRight className="w-5 h-5" />;
      case 'QR_SCAN':
        return <QrCode className="w-5 h-5" />;
      case 'CROSS_CHAIN':
        return <Workflow className="w-5 h-5" />;
      case 'REQUEST':
        return <HandCoins className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'TRANSFER_IN':
      case 'REWARD':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'TRANSFER_OUT':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  if (!isNotificationsOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={() => setIsNotificationsOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div 
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute top-0 inset-x-0 bg-[#0a0a0c]/90 backdrop-blur-3xl border-b border-white/10 rounded-b-[2.5rem] shadow-2xl h-[80vh] flex flex-col overflow-hidden"
        >
          {/* SLIM HEADER NODE */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white">Registry Handshakes</h3>
            </div>
            <button 
              onClick={() => setIsNotificationsOpen(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2 pb-24">
              {!isNotificationsLoaded && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Auditing Ledger...</p>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((n, i) => {
                  const isPositive = n.type === 'TRANSFER_IN' || n.type === 'REWARD';
                  
                  const formattedAmount = n.amount 
                    ? n.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                    : null;
                  
                  const cleanMessage = n.message 
                    ? n.message.replace(/\d+\.?\d*\s*WNC/g, '').replace(/\s+/g, ' ').trim()
                    : 'System update received.';
                  
                  return (
                    <motion.div 
                      key={n.id}
                      initial={{ opacity: 0, x: -20, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      whileHover={{ scale: 1.01 }}
                      className={cn(
                        "group relative overflow-hidden rounded-[1.8rem] border p-0.5 transition-all duration-300 shadow-2xl",
                        n.read ? "bg-white/[0.02] border-white/5" : "bg-primary/[0.05] border-primary/30"
                      )}
                    >
                      <div className={cn(
                        "relative flex gap-3 p-3 rounded-[1.6rem] bg-black/40 backdrop-blur-xl transition-colors group-hover:bg-black/20",
                        !n.read && "border-l-2 border-l-primary"
                      )}>
                        {/* SLIM ICON NODE */}
                        <div className="relative shrink-0">
                          <div className={cn(
                            "w-11 h-11 rounded-2xl flex items-center justify-center border shadow-md transition-transform group-hover:scale-105",
                            getIconColor(n.type)
                          )}>
                            {getIcon(n.type)}
                          </div>

                          {n.sender && (
                            <div className="absolute -bottom-0.5 -right-0.5 border border-[#0a0a0c] rounded-full shadow-md">
                              <Avatar className="w-5 h-5">
                                <AvatarImage src={n.sender.photo_url} />
                                <AvatarFallback className="bg-zinc-900 text-[7px] font-black">{n.sender.name?.[0] || '?'}</AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                        </div>
                        
                        {/* STRETCHED CONTENT NODE */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 pb-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black text-white uppercase tracking-wider truncate">{n.title}</p>
                            {n.sender && (
                              <span className="text-[9px] font-black text-primary uppercase tracking-tighter shrink-0 opacity-60">@{n.sender.name}</span>
                            )}
                          </div>
                          <p className="text-[9px] text-muted-foreground leading-tight font-medium line-clamp-1">
                            {cleanMessage}
                          </p>
                          <span className="text-[7px] font-black text-white/20 uppercase tracking-widest mt-0.5">
                            {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : 'Just now'}
                          </span>
                        </div>

                        {/* BOTTOM-LEFT AMOUNT PILL */}
                        {formattedAmount && (
                          <div className={cn(
                            "absolute bottom-2 left-[60px] px-2.5 py-0.5 rounded-full text-[9px] font-black tabular-nums border shadow-xl z-20",
                            isPositive ? "bg-green-500 text-white border-green-400" : "bg-red-500 text-white border-red-400"
                          )}>
                            {isPositive ? '+' : '-'}{formattedAmount}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <div className="w-16 h-16 rounded-[2rem] bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-white">Registry Nominal</p>
                    <p className="text-[9px] font-medium leading-relaxed max-w-[200px]">
                      No identity events detected.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="h-1 w-10 bg-white/10 rounded-full mx-auto mb-4 shrink-0" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
