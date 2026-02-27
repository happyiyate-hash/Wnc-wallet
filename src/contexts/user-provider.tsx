
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
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('wevina_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        // Map display_name to name and account_number to username for UI compatibility
        setProfile({
          ...data,
          id: data.user_id,
          name: data.display_name,
          username: data.account_number
        } as UserProfile);
      } else {
        // Create initial record if missing to ensure we have an anchor
        const { data: newProfile } = await supabase
          .from('wevina_profiles')
          .upsert({ 
            user_id: userId, 
            display_name: user?.email?.split('@')[0] || 'Institutional User' 
          }, { onConflict: 'user_id' })
          .select()
          .single();
        
        if (newProfile) {
          setProfile({
            ...newProfile,
            id: newProfile.user_id,
            name: newProfile.display_name,
            username: newProfile.account_number
          } as UserProfile);
        }
      }
    } catch (e) {
      console.warn("Profile fetch error:", e);
    }
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
        if (currentUser) await fetchProfile(currentUser.id);
      } catch (e) {
        console.error("Session check failed:", e);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <UserContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
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
