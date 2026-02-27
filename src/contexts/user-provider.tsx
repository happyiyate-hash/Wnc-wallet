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
  
  // Multi-Account State
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Initialize Sessions from Local Storage
  useEffect(() => {
    const savedSessions = localStorage.getItem('wevina_sessions');
    const savedActiveId = localStorage.getItem('wevina_active_session_id');
    
    if (savedSessions) {
        try {
            setSessions(JSON.parse(savedSessions));
        } catch (e) {}
    }
    if (savedActiveId) {
        setActiveSessionId(savedActiveId);
    }
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('wevina_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        const resolvedProfile = {
          ...data,
          id: data.user_id,
          name: data.display_name,
          username: data.account_number
        } as UserProfile;
        setProfile(resolvedProfile);
        return resolvedProfile;
      }
    } catch (e) {}
    return null;
  };

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
            // Update sessions list if new
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
    }
  }, [activeSessionId]);

  const switchSession = async (sessionId: string) => {
    const target = sessions.find(s => s.id === sessionId);
    if (!target) return;

    setLoading(true);
    try {
        // In a multi-account system, we'd restore the specific Supabase session here
        // For now, we update the active ID and the WalletProvider will react to key changes
        setActiveSessionId(sessionId);
        localStorage.setItem('wevina_active_session_id', sessionId);
        setProfile(target.profile);
        // If mnemonic exists in session, ensure it's in the primary local storage slot
        if (target.encryptedMnemonic) {
            localStorage.setItem(`wallet_mnemonic_${sessionId}`, target.encryptedMnemonic);
        }
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
