
'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { useToast } from '@/hooks/use-toast';
import { ArrowDownLeft, Zap, ArrowUpRight, HandCoins } from 'lucide-react';
import type { Notification } from '@/lib/types';

/**
 * INSTITUTIONAL REAL-TIME SENTINEL (SYNC ENGINE)
 * Version: 8.0.0 (Global Independent Listener)
 * 
 * This component handles the background synchronization of the notification registry.
 * It operates independently of the UI panels to ensure constant real-time connectivity.
 */
export default function RealtimeNotificationListener() {
  const { user } = useUser();
  const { setUnreadCount, refresh, setNotifications, setIsNotificationsLoaded } = useWallet();
  const { toast } = useToast();
  const hasInitializedRef = useRef(false);

  // 1. INITIAL REGISTRY HANDSHAKE
  useEffect(() => {
    if (!user || !supabase || hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const fetchInitialBatch = async () => {
      try {
        const { data, error } = await supabase
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

        if (!error && data) {
          setNotifications(data as Notification[]);
          setIsNotificationsLoaded(true);
          
          // Calculate unread count from fetched batch
          const unread = data.filter(n => !n.read).length;
          setUnreadCount(unread);
        }
      } catch (e) {
        console.warn("[SENTINEL] Initial handshake deferred.");
      }
    };

    fetchInitialBatch();
  }, [user, setNotifications, setIsNotificationsLoaded, setUnreadCount]);

  // 2. PERSISTENT REAL-TIME SUBSCRIPTION
  useEffect(() => {
    if (!user || !supabase) return;

    const channel = supabase
      .channel(`registry-handshakes-global-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, async (payload) => {
          console.log("[SENTINEL] New identity event detected:", payload.new);
          
          // Enrich the notification with sender details (Silent Fetch)
          const { data: enriched } = await supabase
            .from('notifications')
            .select('*, sender:from_user_id(name, photo_url)')
            .eq('id', payload.new.id)
            .single();

          const newNode = (enriched || payload.new) as Notification;

          // 1. Atomic UI State Update (Global Prepend)
          setNotifications(prev => [newNode, ...prev].slice(0, 25));
          
          // 2. Increment Numerical Counter
          setUnreadCount(prev => prev + 1);
          
          // 3. Map Visual Meta for Toast
          const type = newNode.type;
          const Icon = type === 'TRANSFER_IN' || type === 'REWARD' ? ArrowDownLeft : 
                       type === 'TRANSFER_OUT' ? ArrowUpRight : 
                       type === 'REQUEST' ? HandCoins : Zap;
          
          // 4. Dispatch High-Fidelity Toast
          toast({
              title: newNode.title || "Registry Alert",
              description: newNode.message,
              action: (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(139,92,246,0.3)] border border-primary/20">
                  <Icon className="w-5 h-5" />
                </div>
              )
          });
          
          // 5. Trigger Ledger Balance Revalidation
          refresh(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setUnreadCount, refresh, toast, setNotifications]);

  return null;
}
