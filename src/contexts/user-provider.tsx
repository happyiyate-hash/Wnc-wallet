
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import type { UserProfile, LocalSession } from '@/lib/types';

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  sessions: LocalSession[];
  activeSessionId: string | null;
  switchSession: (sessionId: string) => Promise<void>;
  addSession: (session: LocalSession) => void;
  removeSession: (sessionId: string) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

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
   * ECOSYSTEM REAL-TIME SYNC
   * Subscribes to changes in the profiles table to reflect SmarterSeller updates instantly.
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
        // Atomic UI Update
        const updatedProfile = payload.new as UserProfile;
        setProfile(updatedProfile);
        localStorage.setItem(`profile_cache_${user.id}`, JSON.stringify(updatedProfile));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const savedSessions = localStorage.getItem('wevina_sessions');
    const savedActiveId = localStorage.getItem('wevina_active_session_id');
    
    if (savedSessions) {
        try { setSessions(JSON.parse(savedSessions)); } catch (e) {}
    }
    
    if (savedActiveId) {
        setActiveSessionId(savedActiveId);
        // INSTANT LOAD: Use stale cache while revalidation happens in background
        const cacheKey = `profile_cache_${savedActiveId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try { setProfile(JSON.parse(cached)); } catch (e) {}
        }
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
            await fetchProfile(currentUser.id);
            setActiveSessionId(currentUser.id);
            localStorage.setItem('wevina_active_session_id', currentUser.id);
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const p = await fetchProfile(currentUser.id);
        if (p) {
            setSessions(prev => {
                const existing = prev.find(s => s.id === currentUser.id);
                if (existing) return prev;
                const newSessions = [...prev, {
                    id: currentUser.id,
                    profile: p,
                    encryptedMnemonic: null,
                    encryptedApiKey: null,
                    lastActive: Date.now()
                }];
                localStorage.setItem('wevina_sessions', JSON.stringify(newSessions));
                return newSessions;
            });
        }
        setActiveSessionId(currentUser.id);
        localStorage.setItem('wevina_active_session_id', currentUser.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setActiveSessionId(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const addSession = useCallback((session: LocalSession) => {
    setSessions(prev => {
        const filtered = prev.filter(s => s.id !== session.id);
        const next = [...filtered, session];
        localStorage.setItem('wevina_sessions', JSON.stringify(next));
        return next;
    });
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    setSessions(prev => {
        const next = prev.filter(s => s.id !== sessionId);
        localStorage.setItem('wevina_sessions', JSON.stringify(next));
        return next;
    });
    if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        localStorage.removeItem('wevina_active_session_id');
        localStorage.removeItem(`profile_cache_${sessionId}`);
    }
  }, [activeSessionId]);

  const switchSession = async (sessionId: string) => {
    const target = sessions.find(s => s.id === sessionId);
    if (!target) return;

    setLoading(true);
    try {
        setActiveSessionId(sessionId);
        localStorage.setItem('wevina_active_session_id', sessionId);
        // Load target cache instantly
        const cached = localStorage.getItem(`profile_cache_${sessionId}`);
        if (cached) setProfile(JSON.parse(cached));
        await fetchProfile(sessionId);
    } finally {
        setLoading(false);
    }
  };

  const signOut = async () => {
    if (supabase) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setActiveSessionId(null);
        localStorage.removeItem('wevina_active_session_id');
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
        sessions, 
        activeSessionId, 
        switchSession, 
        addSession, 
        removeSession, 
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
