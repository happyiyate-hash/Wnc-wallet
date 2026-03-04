'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/types';

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as UserProfile);
        // SMART CACHE: Store profile for instant loading on next visit
        localStorage.setItem(`profile_cache_${userId}`, JSON.stringify(data));
        return data as UserProfile;
      }
    } catch (e) {
        console.warn("Profile fetch error:", e);
    }
    return null;
  };

  /**
   * HYDRATION & REVALIDATION
   */
  useEffect(() => {
    // 1. Initial Cache Hydration (Browser only)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('profile_cache_')) {
        try {
          const cached = JSON.parse(localStorage.getItem(key)!);
          setProfile(cached);
          break;
        } catch (e) { /* silent skip */ }
      }
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    // 2. Session Revalidation
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
            await fetchProfile(currentUser.id);
        }
      } catch (e) {
        console.error("[INIT_SESSION_FAIL]", e);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * ECOSYSTEM REAL-TIME SYNC
   */
  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel(`profile-sync-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`
      }, (payload) => {
        const updatedProfile = payload.new as UserProfile;
        setProfile(updatedProfile);
        localStorage.setItem(`profile_cache_${user.id}`, JSON.stringify(updatedProfile));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const signOut = async () => {
    if (supabase) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <UserContext.Provider value={{ 
        user, 
        profile, 
        loading, 
        signOut, 
        refreshProfile 
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
