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

  // 1. CACHE-THEN-NETWORK: Initial Local Load
  useEffect(() => {
    const savedSessions = localStorage.getItem('wevina_sessions');
    const savedActiveId = localStorage.getItem('wevina_active_session_id');
    
    if (savedSessions) {
        try { setSessions(JSON.parse(savedSessions)); } catch (e) {}
    }
    
    if (savedActiveId) {
        setActiveSessionId(savedActiveId);
        // INSTANT UI: Load profile from local cache key
        const cacheKey = `profile_cache_${savedActiveId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                setProfile(JSON.parse(cached));
                setLoading(false); // Clear loading immediately for 0ms UI
            } catch (e) {}
        }
    }
  }, []);

  // 2. SHARED BACKEND: Fetch from 'profiles' table
  const fetchProfile = async (userId: string) => {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const resolvedProfile = data as UserProfile;
        
        setProfile(resolvedProfile);
        // Update Cache
        localStorage.setItem(`profile_cache_${userId}`, JSON.stringify(resolvedProfile));
        return resolvedProfile;
      } else if (error && error.code === 'PGRST116') {
        // First-time identity generation if missing in public.profiles
        const { data: newProfile } = await supabase
            .from('profiles')
            .upsert({ id: userId, name: user?.email?.split('@')[0] || 'Institutional User', wnc_earnings: 0, tokens: 0 })
            .select()
            .single();
        return newProfile ? (newProfile as UserProfile) : null;
      }
    } catch (e) {
        console.warn("Profile fetch error:", e);
    }
    return null;
  };

  // 3. REALTIME SYNCHRONIZATION
  useEffect(() => {
    if (!user || !supabase) return;

    const channel = supabase
      .channel(`profile-updates-${user.id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'profiles', 
          filter: `id=eq.${user.id}` 
      }, (payload) => {
          const updated = payload.new as UserProfile;
          if (updated) {
              setProfile(updated);
              localStorage.setItem(`profile_cache_${user.id}`, JSON.stringify(updated));
          }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 4. SESSION & AUTH MANAGEMENT
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
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.email]);

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
        
        // Try cache first for the switch
        const cached = localStorage.getItem(`profile_cache_${sessionId}`);
        if (cached) setProfile(JSON.parse(cached));
        
        // Restore local credentials if available in session vault
        if (target.encryptedMnemonic) {
            localStorage.setItem(`wallet_mnemonic_${sessionId}`, target.encryptedMnemonic);
        }
        
        // Background refresh
        await fetchProfile(sessionId);
    } finally {
        setLoading(false);
    }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
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
