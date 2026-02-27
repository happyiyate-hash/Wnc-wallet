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

  // 1. Initial Local Load (Cache-then-Network Strategy)
  useEffect(() => {
    const savedSessions = localStorage.getItem('wevina_sessions');
    const savedActiveId = localStorage.getItem('wevina_active_session_id');
    
    if (savedSessions) {
        try { setSessions(JSON.parse(savedSessions)); } catch (e) {}
    }
    
    if (savedActiveId) {
        setActiveSessionId(savedActiveId);
        // Instant UI: Try to load profile from specific account cache
        const cachedProfile = localStorage.getItem(`profile_cache_${savedActiveId}`);
        if (cachedProfile) {
            try {
                setProfile(JSON.parse(cachedProfile));
                setLoading(false); // Stop loading immediately if we have a cache
            } catch (e) {}
        }
    }
  }, []);

  // 2. Optimized Fetch with Background Refresh
  const fetchProfile = async (userId: string) => {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('wevina_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        // AUTO-GENERATION: 10-digit ID if missing
        if (!data.account_number) {
            const newId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            await supabase.from('wevina_profiles').update({ account_number: newId }).eq('user_id', userId);
            data.account_number = newId;
        }

        const resolvedProfile = {
          ...data,
          id: data.user_id,
          name: data.display_name,
          username: data.account_number 
        } as UserProfile;
        
        setProfile(resolvedProfile);
        localStorage.setItem(`profile_cache_${userId}`, JSON.stringify(resolvedProfile));
        return resolvedProfile;
      } else if (error && error.code === 'PGRST116') {
        const { data: newProfile } = await supabase
            .from('wevina_profiles')
            .upsert({ user_id: userId, display_name: 'Institutional User' })
            .select()
            .single();
        return newProfile ? await fetchProfile(userId) : null;
      }
    } catch (e) {
        console.warn("Profile fetch error:", e);
    }
    return null;
  };

  // 3. Realtime Synchronization
  useEffect(() => {
    if (!user || !supabase) return;

    const channel = supabase
      .channel(`profile-sync-${user.id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'wevina_profiles', 
          filter: `user_id=eq.${user.id}` 
      }, (payload) => {
          const updated = payload.new as any;
          if (updated) {
              const resolved = {
                  ...updated,
                  id: updated.user_id,
                  name: updated.display_name,
                  username: updated.account_number
              } as UserProfile;
              setProfile(resolved);
              localStorage.setItem(`profile_cache_${user.id}`, JSON.stringify(resolved));
          }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 4. Session & Auth Management
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
        
        // Try cache first for the switch
        const cached = localStorage.getItem(`profile_cache_${sessionId}`);
        if (cached) setProfile(JSON.parse(cached));
        
        // Sync mnemonic
        if (target.encryptedMnemonic) {
            localStorage.setItem(`wallet_mnemonic_${sessionId}`, target.encryptedMnemonic);
        }
        
        // Perform background refresh
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
