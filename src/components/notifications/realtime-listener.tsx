
'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/contexts/user-provider';
import { useWallet } from '@/contexts/wallet-provider';
import { useToast } from '@/hooks/use-toast';
import { ArrowDownLeft, Zap, ArrowUpRight } from 'lucide-react';
import React from 'react';

/**
 * INSTITUTIONAL REAL-TIME SENTINEL
 * Monitors the 'notifications' node for verified ledger events.
 */
export default function RealtimeNotificationListener() {
  const { user } = useUser();
  const { setHasNewNotifications, refresh } = useWallet();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !supabase) return;

    // Establishing the high-fidelity real-time tunnel
    const channel = supabase
      .channel(`registry-handshakes-${user.id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
      }, (payload) => {
          // 1. Alert the navigation node
          setHasNewNotifications(true);
          
          // 2. Map visual icon based on handshake type
          const type = payload.new.type;
          const Icon = type === 'TRANSFER_IN' || type === 'REWARD' ? ArrowDownLeft : ArrowUpRight;
          
          // 3. Dispatch Visual Toast
          toast({
              title: payload.new.title || "Registry Alert",
              description: payload.new.message,
              action: (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Icon className="w-5 h-5" />
                </div>
              )
          });
          
          // 4. Force Silent Registry Refresh
          // This ensures balances update instantly without a manual pull.
          refresh(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, setHasNewNotifications, refresh, toast]);

  return null;
}
