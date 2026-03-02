
'use client';

import { useState, useEffect, useRef } from 'react';
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

/**
 * IDENTITY NODE PROVISIONING
 * Handles final profile setup including unique username selection and 
 * institutional image uplink via the canonical 'photos' bucket registry.
 * Hardened with atomic state management to prevent infinite loading.
 */
export default function CompleteProfilePage() {
  const { user, profile, refreshProfile } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
      console.error("USERNAME_CHECK_ERROR:", e);
    } finally {
      setIsValidating(false);
    }
  };

  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !supabase) return;

    setIsUploading(true);
    try {
      // PATH STRUCTURE: profiles/{user_id}/{timestamp}-{filename}
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name.replace(/\s+/g, '_')}`;
      const filePath = `profiles/${user.id}/${fileName}`;

      // 1. UPLINK: Upload to 'photos' bucket
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // 2. RESOLVE: Get absolute public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      setPhotoUrl(publicUrl);
      toast({ title: "Visual Node Linked", description: "Institutional avatar updated in the cloud." });
    } catch (error: any) {
      console.error('UPLOAD_ERROR:', error);
      toast({ 
        variant: "destructive", 
        title: "Uplink Failed", 
        description: error.message || "Failed to upload image. Ensure the 'photos' bucket is configured." 
      });
    } finally {
      // ALWAYS stop loading state
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAvailable || !supabase) return;

    setIsSubmitting(true);
    try {
      // 1. SYNC AUTH METADATA (SmarterSeller Standard for instant name recognition)
      await supabase.auth.updateUser({
        data: { name: username }
      });

      // 2. ATOMIC UPSERT TO PROFILES (Resilient to missing onboarding columns)
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: username,
          photo_url: photoUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) throw error;

      await refreshProfile();
      toast({ title: "Profile Secured!", description: "Identity node synchronized." });
      
      // Navigate to wallet session
      router.push('/wallet-session');
    } catch (error: any) {
      console.error("SAVE_PROFILE_ERROR:", error);
      toast({ 
        variant: "destructive", 
        title: "Authorization Failed", 
        description: error.message || "Could not synchronize identity node." 
      });
    } finally {
      // ALWAYS stop loading state to prevent infinite spinners
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] p-6 text-foreground">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-sm space-y-10"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Identity Node</h1>
          <p className="text-sm text-muted-foreground uppercase font-bold tracking-widest opacity-60">Complete your profile to continue</p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="relative group">
            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
            <Avatar className="w-32 h-32 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl relative z-10 overflow-hidden">
              {isUploading ? (
                <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : null}
              <AvatarImage src={photoUrl} className="object-cover" />
              <AvatarFallback className="bg-zinc-900 text-primary font-black text-4xl">
                <UserCircle className="w-16 h-16" />
              </AvatarFallback>
            </Avatar>
            <button 
              type="button"
              onClick={handleImageSelect}
              className="absolute -bottom-2 -right-2 z-20 bg-primary p-3 rounded-2xl border-4 border-[#050505] shadow-xl hover:scale-110 active:scale-95 transition-transform"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-10">
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

          <Button 
            type="submit"
            className="w-full h-16 rounded-2xl font-black text-sm uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
            disabled={isSubmitting || isUploading || !isAvailable || username.length < 3}
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
