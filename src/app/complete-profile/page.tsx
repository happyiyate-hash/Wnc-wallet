
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/user-provider';
import { Loader2, UserCircle, ShieldCheck, Camera, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';

export default function CompleteProfilePage() {
  const { user, profile, refreshProfile } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // Populate with Google metadata if available
    if (user?.user_metadata?.full_name && !username) {
        setUsername(user.user_metadata.full_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
    }
    if (user?.user_metadata?.avatar_url && !photoUrl) {
        setPhotoUrl(user.user_metadata.avatar_url);
    }
    
    if (profile?.name) setUsername(profile.name);
    if (profile?.photo_url) setPhotoUrl(profile.photo_url);
  }, [profile, user]);

  const checkUsername = async (val: string) => {
    if (val.length < 3) {
      setIsAvailable(null);
      return;
    }
    setIsValidating(true);
    try {
      const { data, error } = await supabase!
        .from('profiles')
        .select('name')
        .eq('name', val)
        .maybeSingle();
      
      if (error) throw error;
      setIsAvailable(!data || data.name === profile?.name);
    } catch (e) {
      console.error(e);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAvailable) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase!
        .from('profiles')
        .update({
          name: username,
          photo_url: photoUrl,
          onboarding_completed: false // Will be true after wallet setup
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast({ title: "Profile Secured!", description: "Now let's initialize your vault." });
      router.push('/wallet-session');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] p-6 text-foreground">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm space-y-10"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Identity Node</h1>
          <p className="text-sm text-muted-foreground uppercase font-bold tracking-widest opacity-60">Complete your profile to continue</p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
            <Avatar className="w-32 h-32 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl relative z-10">
              <AvatarImage src={photoUrl} className="object-cover" />
              <AvatarFallback className="bg-zinc-900 text-primary font-black text-4xl">
                <UserCircle className="w-16 h-16" />
              </AvatarFallback>
            </Avatar>
            <button className="absolute -bottom-2 -right-2 z-20 bg-primary p-3 rounded-2xl border-4 border-[#050505] shadow-xl hover:scale-110 active:scale-95 transition-transform">
              <Camera className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center px-2">
              <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Global Username</Label>
              {isAvailable === true && <span className="text-[8px] font-black text-green-500 uppercase flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Available</span>}
              {isAvailable === false && <span className="text-[8px] font-black text-red-500 uppercase">Taken</span>}
            </div>
            <div className="relative">
              <Input 
                placeholder="Institutional ID"
                value={username}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                  setUsername(val);
                  checkUsername(val);
                }}
                className="h-14 bg-white/5 border-white/10 rounded-2xl pl-4 pr-10 text-white placeholder:text-zinc-700 focus-visible:ring-primary font-bold"
                required
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isValidating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2">Avatar URL (Optional)</Label>
            <Input 
              placeholder="https://..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-zinc-700 focus-visible:ring-primary"
            />
          </div>

          <Button 
            type="submit"
            className="w-full h-16 rounded-2xl font-black text-sm uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
            disabled={isSubmitting || !isAvailable || username.length < 3}
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authorize Profile"}
          </Button>
        </form>

        <div className="pt-4 flex flex-col items-center gap-3 opacity-20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white">Public Registry Protocol v3.1</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
