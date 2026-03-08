
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
 * Version: 7.0.0 (Reactive Counting Sync)
 */
export default function RealtimeNotificationListener() {
  const { user } = useUser();
  const { setUnreadCount, refresh } = useWallet();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !supabase) return;

    const channel = supabase
      .channel(`registry-handshakes-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, (payload) => {
          console.log("[SENTINEL] New identity event detected:", payload.new);
          
          // 1. Increment Numerical Counter
          setUnreadCount(prev => prev + 1);
          
          // 2. Map Visual Meta
          const type = payload.new.type;
          const Icon = type === 'TRANSFER_IN' || type === 'REWARD' ? ArrowDownLeft : 
                       type === 'TRANSFER_OUT' ? ArrowUpRight : 
                       type === 'REQUEST' ? HandCoins : Zap;
          
          // 3. Dispatch High-Fidelity Toast
          toast({
              title: payload.new.title || "Registry Alert",
              description: payload.new.message,
              action: (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(139,92,246,0.3)] border border-primary/20">
                  <Icon className="w-5 h-5" />
                </div>
              )
          });
          
          // 4. Ledger Synchronization
          refresh(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setUnreadCount, refresh, toast]);

  return null;
}
