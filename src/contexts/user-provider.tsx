'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
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
  const hasInitializedRef = useRef(false);

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
        console.warn("[REGISTRY_PROFILE_ADVISORY]", e);
    }
    return null;
  };

  /**
   * INSTITUTIONAL AUTH BOOT SEQUENCE
   * Hardened with a fail-fast safety timeout to prevent permanent hangs.
   */
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // 1. SAFETY SENTINEL: Fail-fast if session takes too long
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("[AUTH_SENTINEL] Fail-safe triggered. Releasing terminal lock.");
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    // 2. Initial Cache Hydration (Zero-Latency UI)
    if (typeof window !== 'undefined') {
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
    }

    if (!supabase) {
      setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    // 3. CORE SESSION HANDSHAKE
    const checkSession = async () => {
      try {
        console.log("[AUTH_TERMINAL] Verifying identity session...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
            // FIRE AND FORGET: Start profile fetch but don't block the auth loading flag
            // This prevents "Verifying Identity" from hanging on profiles table latency.
            fetchProfile(currentUser.id).finally(() => {
              setLoading(false);
              clearTimeout(safetyTimeout);
            });
        } else {
          setLoading(false);
          clearTimeout(safetyTimeout);
        }
      } catch (e) {
        console.error("[AUTH_TERMINAL_FAIL]", e);
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    };

    checkSession();

    // 4. REAL-TIME SESSION LISTENER
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AUTH_EVENT] ${event}`);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setUser(null);
      }
      
      setLoading(false);
      clearTimeout(safetyTimeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  /**
   * REAL-TIME REGISTRY SYNC
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
