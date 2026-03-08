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
 * Version: 11.0.0 (Persistent Handshake Sentinel)
 * 
 * Optimized to handle user session transitions without losing the subscription.
 * Implements tiered error handling for identity joins.
 */
export default function RealtimeNotificationListener() {
  const { user } = useUser();
  const { setUnreadCount, refresh, setNotifications, setIsNotificationsLoaded } = useWallet();
  const { toast } = useToast();
  
  // Track current user ID to avoid redundant re-fetches if identity hasn't actually changed
  const lastUserIdRef = useRef<string | null>(null);

  // 1. INITIAL REGISTRY FETCH
  useEffect(() => {
    if (!user || !supabase || lastUserIdRef.current === user.id) return;
    lastUserIdRef.current = user.id;

    const fetchInitialBatch = async () => {
      console.log("[SENTINEL] Syncing notification registry for node:", user.id);
      
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*, sender:from_user_id(name, photo_url)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25);

        if (error) {
          console.warn("[SENTINEL] Join handshake failed, retrying raw fetch...");
          // Fallback to raw fetch without join if profile permissions are restricted
          const { data: rawData } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(25);
          
          if (rawData) {
            setNotifications(rawData as Notification[]);
            setUnreadCount(rawData.filter(n => !n.read).length);
          }
        } else if (data) {
          setNotifications(data as Notification[]);
          const unread = data.filter(n => !n.read).length;
          setUnreadCount(unread);
        }
      } catch (e) {
        console.warn("[SENTINEL] Registry handshake deferred.");
      } finally {
        setIsNotificationsLoaded(true);
      }
    };

    fetchInitialBatch();
  }, [user, setNotifications, setIsNotificationsLoaded, setUnreadCount]);

  // 2. PERSISTENT REAL-TIME SUBSCRIPTION
  useEffect(() => {
    if (!user || !supabase) return;

    console.log("[SENTINEL] Establishing real-time channel for node:", user.id);

    const channel = supabase
      .channel(`registry-alerts-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, async (payload) => {
          console.log("[SENTINEL] New ledger event detected:", payload.new.id);
          
          // Attempt to enrich the node with identity metadata
          const { data: enriched } = await supabase
            .from('notifications')
            .select('*, sender:from_user_id(name, photo_url)')
            .eq('id', payload.new.id)
            .single();

          const newNode = (enriched || payload.new) as Notification;

          // Atomic State Update
          setNotifications(prev => [newNode, ...prev].slice(0, 25));
          setUnreadCount(prev => prev + 1);
          
          // Visual Handshake (Toast)
          const type = newNode.type;
          const Icon = type === 'TRANSFER_IN' || type === 'REWARD' ? ArrowDownLeft : 
                       type === 'TRANSFER_OUT' ? ArrowUpRight : 
                       type === 'REQUEST' ? HandCoins : Zap;
          
          toast({
              title: newNode.title || "Registry Alert",
              description: newNode.message,
              action: (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-lg border border-primary/20">
                  <Icon className="w-5 h-5" />
                </div>
              )
          });
          
          // Refresh balances to reflect the new state
          refresh(); 
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("[SENTINEL] Real-time node status: ACTIVE");
        }
      });

    return () => {
      console.log("[SENTINEL] Terminating channel for node:", user.id);
      supabase.removeChannel(channel);
    };
  }, [user, setUnreadCount, refresh, toast, setNotifications]);

  return null;
}
