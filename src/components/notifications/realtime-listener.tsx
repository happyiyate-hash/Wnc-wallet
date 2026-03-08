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
 * Version: 13.0.0 (Hardened Identity Join)
 * 
 * Implements a two-layer synchronization:
 * 1. Initial Registry Fetch (Layer 1): Guaranteed retrieval of historical alerts.
 * 2. Sentinel Stream (Layer 2): Persistent real-time channel for live events.
 */
export default function RealtimeNotificationListener() {
  const { user } = useUser();
  const { setUnreadCount, refresh, setNotifications, setIsNotificationsLoaded } = useWallet();
  const { toast } = useToast();
  
  const lastUserIdRef = useRef<string | null>(null);

  // 1. INSTITUTIONAL REGISTRY FETCH (Guaranteed Handshake)
  useEffect(() => {
    if (!user || !supabase || lastUserIdRef.current === user.id) {
      if (!user) setIsNotificationsLoaded(true);
      return;
    }
    
    lastUserIdRef.current = user.id;

    const fetchInitialBatch = async () => {
      console.log("[SENTINEL] Syncing notification registry for node:", user.id);
      
      try {
        // Attempt high-fidelity fetch with explicit identity metadata join
        // Using profiles!from_user_id to ensure the correct foreign key is targeted
        const { data, error } = await supabase
          .from('notifications')
          .select('*, sender:profiles!from_user_id(name, photo_url)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25);

        if (error) {
          console.warn("[SENTINEL] Join handshake deferred, attempting raw fallback...");
          // FALLBACK: Raw fetch without profile joins
          const { data: rawData, error: rawError } = await supabase
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
          setUnreadCount(data.filter(n => !n.read).length);
        }
      } catch (e) {
        console.error("[SENTINEL] Registry fetch interrupted.");
      } finally {
        setIsNotificationsLoaded(true);
      }
    };

    fetchInitialBatch();
  }, [user, setNotifications, setIsNotificationsLoaded, setUnreadCount]);

  // 2. PERSISTENT SENTINEL STREAM (Filtered Subscription)
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
          
          // Attempt to enrich node metadata for the UI
          const { data: enriched } = await supabase
            .from('notifications')
            .select('*, sender:profiles!from_user_id(name, photo_url)')
            .eq('id', payload.new.id)
            .single();

          const newNode = (enriched || payload.new) as Notification;

          // Atomic UI Update
          setNotifications(prev => [newNode, ...prev].slice(0, 25));
          setUnreadCount(prev => prev + 1);
          
          // Visual Handshake
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
          
          refresh(); 
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("[SENTINEL] Real-time node status: ACTIVE");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setUnreadCount, refresh, toast, setNotifications]);

  return null;
}
