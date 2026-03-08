
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/types';

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSettled: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * INSTITUTIONAL USER & IDENTITY PROVIDER
 * Version: 11.0.0 (The Professional Handshake)
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSettled, setIsSettled] = useState(false);
  const hasInitializedRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as UserProfile);
        localStorage.setItem(`profile_cache_${userId}`, JSON.stringify(data));
        return data as UserProfile;
      }
    } catch (e) {
        console.warn("[REGISTRY_PROFILE_ADVISORY]", e);
    }
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      setIsSettled(true);
    }, 12000);

    // 1. FAST HYDRATION: Check local cache
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        const profileKey = keys.find(k => k.startsWith('profile_cache_'));
        if (profileKey) {
          const cached = JSON.parse(localStorage.getItem(profileKey)!);
          if (cached) setProfile(cached);
        }
      } catch (e) {}
    }

    if (!supabase) {
      setLoading(false);
      setIsSettled(true);
      clearTimeout(safetyTimeout);
      return;
    }

    // 2. CORE SESSION RECOVERY
    const initSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (e) {
        console.warn("[AUTH_BOOT_FAIL] Identity recovery deferred.");
      } finally {
        setLoading(false);
        setIsSettled(true);
        clearTimeout(safetyTimeout);
      }
    };

    initSession();

    // 3. REAL-TIME AUTHORITY LISTENER
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setUser(null);
        if (typeof window !== 'undefined') {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith('profile_cache_')) localStorage.removeItem(k);
          });
        }
      }
      
      setLoading(false);
      setIsSettled(true);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [fetchProfile]);

  /**
   * PROFESSIONAL HEARTBEAT (Backup Trigger)
   * Fetches the latest WNC balance every 5 seconds to ensure accuracy.
   */
  useEffect(() => {
    if (!user) return;

    const heartbeat = setInterval(() => {
      refreshProfile();
    }, 5000);

    return () => clearInterval(heartbeat);
  }, [user, refreshProfile]);

  const signOut = async () => {
    if (supabase) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
    }
  };

  return (
    <UserContext.Provider value={{ 
        user, 
        profile, 
        loading, 
        isSettled,
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
