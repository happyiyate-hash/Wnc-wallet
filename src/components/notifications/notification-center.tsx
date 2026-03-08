
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ShieldAlert, Info, Bell, Loader2, X, CheckCircle2, ChevronRight, Zap, ArrowDownLeft, ArrowUpRight, User, QrCode, Workflow } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/contexts/wallet-provider';
import { useUser } from '@/contexts/user-provider';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import type { Notification } from '@/lib/types';

/**
 * INSTITUTIONAL NOTIFICATION CENTER
 * Version: 8.0.0 (Resilient Fetch Node)
 * 
 * Implements a fail-safe strategy for identity joins to prevent empty lists
 * caused by RLS restrictions or missing database relationships.
 */
export default function NotificationCenter() {
  const { isNotificationsOpen, setIsNotificationsOpen, setHasNewNotifications } = useWallet();
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !user || !isNotificationsOpen) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        // 1. TIERED HANDSHAKE: Attempt join with profiles
        let { data, error } = await supabase
          .from('notifications')
          .select(`
            *,
            sender:from_user_id (
              name,
              photo_url
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25);

        // 2. FALLBACK NODE: If join fails (e.g. no FK or RLS on profiles), fetch raw data
        if (error || !data) {
          console.warn("[NOTIFICATION_FETCH] Join deferred, attempting raw fetch:", error?.message);
          const rawFetch = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(25);
          
          if (!rawFetch.error && rawFetch.data) {
            data = rawFetch.data as any;
          }
        }

        if (data) {
          setNotifications(data as Notification[]);
          setHasNewNotifications(false);
          
          const unreadIds = data.filter(n => !n.read).map(n => n.id);
          if (unreadIds.length > 0) {
            await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
          }
        }
      } catch (e) {
        console.error("[REGISTRY_FETCH_FAIL]", e);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-ui-sync-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, (payload) => {
          const newNode = payload.new as Notification;
          setNotifications((prev) => [newNode, ...prev].slice(0, 25));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isNotificationsOpen, user, setHasNewNotifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'TRANSFER_IN':
      case 'REWARD':
        return <ArrowDownLeft className="w-6 h-6" />;
      case 'TRANSFER_OUT':
        return <ArrowUpRight className="w-6 h-6" />;
      case 'QR_SCAN':
        return <QrCode className="w-6 h-6" />;
      case 'CROSS_CHAIN':
        return <Workflow className="w-6 h-6" />;
      default:
        return <Zap className="w-6 h-6" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'TRANSFER_IN':
      case 'REWARD':
        return 'bg-green-500/10 text-green-500';
      case 'TRANSFER_OUT':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-primary/10 text-primary';
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
          className="absolute top-0 inset-x-0 bg-[#0a0a0c] border-b border-white/10 rounded-b-[3.5rem] shadow-2xl h-[75vh] flex flex-col overflow-hidden"
        >
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Identity Alerts</h3>
                <p className="text-[9px] font-black uppercase text-primary opacity-60">Verified Registry Log</p>
              </div>
            </div>
            <button 
              onClick={() => setIsNotificationsOpen(false)}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6 text-muted-foreground" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-3 pb-24">
              {loading && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Auditing Registry...</p>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((n, i) => (
                  <motion.div 
                    key={n.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "p-5 rounded-[2rem] border flex gap-4 transition-all group hover:bg-white/[0.04] relative overflow-hidden",
                      n.read ? "bg-white/[0.01] border-white/5" : "bg-primary/[0.03] border-primary/20 shadow-xl"
                    )}
                  >
                    {!n.read && (
                      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                    
                    <div className="relative shrink-0">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                        getIconColor(n.type)
                      )}>
                        {getIcon(n.type)}
                      </div>
                      {n.sender && (
                        <div className="absolute -bottom-1 -right-1 border-2 border-[#0a0a0c] rounded-full">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={n.sender.photo_url} />
                            <AvatarFallback className="bg-zinc-900 text-[6px] font-black">{n.sender.name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-white uppercase tracking-tight">{n.title}</p>
                        <span className="text-[8px] font-black text-muted-foreground uppercase opacity-40">
                          {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : 'Just now'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                        {n.message}
                      </p>
                      {n.amount && (
                        <div className="pt-1 flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-primary fill-primary opacity-40" />
                          <span className="text-[10px] font-black text-white tabular-nums">
                            {n.type === 'TRANSFER_IN' || n.type === 'REWARD' ? '+' : '-'}{n.amount} {n.token || 'WNC'}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-white">Log Nominal</p>
                    <p className="text-[10px] font-medium leading-relaxed max-w-[200px]">
                      No identity events detected in this epoch.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="h-1.5 w-12 bg-white/10 rounded-full mx-auto mb-6 shrink-0" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
