
'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { useToast } from '@/hooks/use-toast';
import { ArrowDownLeft, Zap, ArrowUpRight, HandCoins } from 'lucide-react';
import React from 'react';

/**
 * INSTITUTIONAL REAL-TIME SENTINEL
 * Version: 6.0.0 (Strict Identity Handshake)
 * 
 * Focus: Event capture and UI Alert triggering.
 * Monitors only the current user's notification node.
 */
export default function RealtimeNotificationListener() {
  const { user } = useUser();
  const { setHasNewNotifications, refresh } = useWallet();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !supabase) return;

    // 1. Establish the filtered real-time channel
    const channel = supabase
      .channel(`registry-handshakes-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, (payload) => {
          console.log("[SENTINEL] New identity event detected:", payload.new);
          
          // 2. Alert the navigation node (triggers the purple dot)
          setHasNewNotifications(true);
          
          // 3. Map visual icon based on event type
          const type = payload.new.type;
          const Icon = type === 'TRANSFER_IN' || type === 'REWARD' ? ArrowDownLeft : 
                       type === 'TRANSFER_OUT' ? ArrowUpRight : 
                       type === 'REQUEST' ? HandCoins : Zap;
          
          // 4. Dispatch Visual Toast
          toast({
              title: payload.new.title || "Registry Alert",
              description: payload.new.message,
              action: (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-lg border border-primary/20">
                  <Icon className="w-5 h-5" />
                </div>
              )
          });
          
          // 5. Force Silent Ledger Refresh
          refresh(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setHasNewNotifications, refresh, toast]);

  return null;
}
