
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/wallet-provider";
import { useUser } from "@/contexts/user-provider";
import { useCurrency } from "@/contexts/currency-provider";
import { supabase } from "@/lib/supabase/client";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { 
  Trash2, 
  ShieldAlert, 
  ArrowLeft, 
  KeyRound, 
  LogOut, 
  Globe, 
  ChevronRight, 
  ShieldCheck,
  Settings2,
  Lock,
  User,
  Loader2,
  ShieldX,
  Camera,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SettingsPage() {
    const { deleteWallet, deleteWalletPermanently, logout } = useWallet();
    const { user, profile, refreshProfile } = useUser();
    const { selectedCurrency, setCurrency, rates, currentSymbol } = useCurrency();
    const { toast } = useToast();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // PROFILE EDIT STATE
    const [username, setUsername] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    // SECURITY PROTOCOL STATE
    const [showPhrase, setShowPhrase] = useState(false);
    const [mnemonic, setMnemonic] = useState<string | null>(null);
    const [isCurrencySheetOpen, setIsCurrencySheetOpen] = useState(false);
    const [currencySearch, setCurrencySearch] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [securityMode, setSecurityMode] = useState<'idle' | 'reveal' | 'destroy' | 'set-password'>('idle');
    const [passwordInput, setPasswordInput] = useState('');
    const [confirmInput, setConfirmInput] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const [isDestroying, setIsDestroying] = useState(false);

    const isGoogleUser = user?.app_metadata?.provider === 'google';

    useEffect(() => {
        if (profile) {
            setUsername(profile.name || '');
            setPhotoUrl(profile.photo_url || '');
            setIsAvailable(true);
        }
    }, [profile]);

    useEffect(() => {
        if (user) {
            const saved = localStorage.getItem(`wallet_mnemonic_${user.id}`);
            setMnemonic(saved);
        }
    }, [user]);

    const checkUsername = async (val: string) => {
        if (!val || val.length < 3) {
            setIsAvailable(null);
            return;
        }
        
        if (val === profile?.name) {
            setIsAvailable(true);
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
            setIsAvailable(!data);
        } catch (e) {
            console.error("USERNAME_CHECK_ERROR:", e);
        } finally {
            setIsValidating(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !supabase) return;

        setIsUploading(true);
        try {
            const timestamp = Date.now();
            const fileName = `profiles/${user.id}/${timestamp}-${file.name.replace(/\s+/g, '_')}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('photos')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('photos')
                .getPublicUrl(uploadData.path);

            setPhotoUrl(publicUrl);
            toast({ title: "Avatar Uplinked", description: "Visual node ready for authorization." });
        } catch (error: any) {
            toast({ 
                variant: "destructive", 
                title: "Upload Failed", 
                description: error.message || "Institutional storage rejected the asset." 
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!user || isAvailable === false || !supabase) return;
        setIsSavingProfile(true);
        try {
            const { error: authError } = await supabase.auth.updateUser({
                data: { 
                    name: username,
                    photo_url: photoUrl || undefined
                }
            });
            if (authError) throw authError;

            const { error: dbError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    name: username,
                    photo_url: photoUrl || undefined,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            if (dbError) throw dbError;

            await refreshProfile();
            toast({ title: "Profile Secured", description: "Identity node fully synchronized with ecosystem." });
        } catch (error: any) {
            toast({ 
                variant: "destructive", 
                title: "Sync Failed", 
                description: error.message || "Institutional handshake interrupted." 
            });
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleVerifyPassword = async () => {
        if (!user?.email || !passwordInput) return;
        setIsVerifying(true);
        try {
            // Re-authenticate node
            const { error } = await supabase!.auth.signInWithPassword({
                email: user.email,
                password: passwordInput
            });
            
            if (error) throw error;

            // Retrieve identity standard from local registry
            const saved = localStorage.getItem(`wallet_mnemonic_${user.id}`);
            setMnemonic(saved);
            
            setIsVerified(true);
            if (securityMode === 'reveal') setShowPhrase(true);
        } catch (e: any) {
            console.error("VERIFICATION_ERROR:", e);
            toast({ 
                title: "Verification Failed", 
                description: e.message || "Invalid password standard.",
                variant: "destructive" 
            });
            setPasswordInput('');
        } finally {
            setIsVerifying(false);
        }
    };

    const handlePermanentDestroy = async () => {
        if (confirmInput !== 'DELETE') return;
        setIsDestroying(true);
        try {
            await deleteWalletPermanently();
            resetSecurityFlow();
            router.push('/');
        } finally {
            setIsDestroying(false);
        }
    };

    const resetSecurityFlow = () => {
        setSecurityMode('idle'); 
        setPasswordInput(''); 
        setIsVerified(false); 
        setConfirmInput(''); 
        setShowPhrase(false);
        setIsVerifying(false);
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
            router.push('/');
        } catch (e) {
            toast({ title: "Logout Error", variant: "destructive" });
        } finally {
            setIsLoggingOut(false);
        }
    };

    const sortedCurrencies = useMemo(() => {
        const codes = Object.keys(rates).sort();
        const popular = ['USD', 'NGN', 'EUR', 'GBP', 'KES', 'GHS', 'ZAR'];
        const filtered = codes.filter(c => c.toLowerCase().includes(currencySearch.toLowerCase()));
        return [...new Set([...popular.filter(p => filtered.includes(p)), ...filtered])];
    }, [rates, currencySearch]);

    const SettingItem = ({ icon: Icon, label, value, onClick, href, destructive, iconBg = "bg-primary/10", iconColor = "text-primary" }: any) => {
        const Content = (
            <div className="flex items-center justify-between w-full group">
                <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-active:scale-90", iconBg, iconColor)}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <p className={cn("text-sm font-bold", destructive ? "text-red-500" : "text-white/90")}>{label}</p>
                        {value && <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60 mt-0.5">{value}</p>}
                    </div>
                </div>
                {!destructive && <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />}
            </div>
        );
        return href ? (<Link href={href} className="flex py-4 px-3 hover:bg-white/5 transition-all rounded-2xl">{Content}</Link>) : (<button onClick={onClick} className="flex w-full py-4 px-3 hover:bg-white/5 transition-all rounded-2xl">{Content}</button>);
    };

    return (
        <div className="flex flex-col min-h-screen bg-transparent text-foreground relative overflow-hidden">
            <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-2xl sticky top-0 z-50">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl"><ArrowLeft className="w-5 h-5" /></Button>
                <div className="flex flex-col items-center">
                    <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none text-white/90">Institutional Settings</h1>
                    <div className="flex items-center gap-1.5 mt-1.5"><Settings2 className="w-2.5 h-2.5 text-primary" /><span className="text-[8px] text-primary font-black uppercase tracking-tighter">System Preferences</span></div>
                </div>
                <div className="w-10" />
            </header>

            <main className="flex-1 overflow-y-auto thin-scrollbar pb-32 relative z-10">
                <div className="max-w-2xl mx-auto p-6 space-y-8">
                    
                    <section className="space-y-4">
                        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Identity Node configuration</h2>
                        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6 space-y-8 shadow-2xl">
                            <div className="flex flex-col items-center gap-6">
                                <div className="relative group">
                                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl opacity-50 transition-opacity" />
                                    <Avatar className="w-32 h-32 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl relative z-10 overflow-hidden">
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                            </div>
                                        )}
                                        <AvatarImage src={photoUrl} className="object-cover" />
                                        <AvatarFallback className="bg-zinc-900 text-primary font-black text-4xl">
                                            <User className="w-16 h-16" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute -bottom-2 -right-2 z-20 bg-primary p-3 rounded-2xl border-4 border-[#050505] shadow-xl hover:scale-110 active:scale-95 transition-transform"
                                    >
                                        <Camera className="w-5 h-5 text-white" />
                                    </button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-2">
                                        <Label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Registry Username</Label>
                                        {isAvailable === true && username.length >= 3 && <span className="text-[8px] font-black text-green-500 uppercase flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Available</span>}
                                        {isAvailable === false && <span className="text-[8px] font-black text-red-500 uppercase flex items-center gap-1"><XCircle className="w-2.5 h-2.5" /> Taken</span>}
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
                                            className={cn(
                                                "h-14 bg-white/5 border-white/10 rounded-2xl pl-4 pr-10 text-white font-bold focus-visible:ring-primary transition-all",
                                                isAvailable === false && "border-red-500/50 bg-red-500/5"
                                            )}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            {isValidating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                            {!isValidating && isAvailable === true && username.length >= 3 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                            {!isValidating && isAvailable === false && <AlertCircle className="w-4 h-4 text-red-500" />}
                                        </div>
                                    </div>
                                </div>

                                <Button 
                                    className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95"
                                    disabled={isSavingProfile || isUploading || isAvailable === false || username.length < 3 || (username === profile?.name && photoUrl === profile?.photo_url)}
                                    onClick={handleSaveProfile}
                                >
                                    {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authorize Profile"}
                                </Button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Regional & Ecosystem</h2>
                        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-2 space-y-1">
                            <SettingItem icon={Globe} label="Display Currency" value={`${selectedCurrency} (${currentSymbol})`} iconBg="bg-blue-500/10" iconColor="text-blue-400" onClick={() => setIsCurrencySheetOpen(true)} />
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Security & Privacy</h2>
                        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-2 space-y-1">
                            <SettingItem icon={KeyRound} label="Manage API Keys" value="Infura / Network RPCs" iconBg="bg-orange-500/10" iconColor="text-orange-400" href="/settings/api-keys" />
                            <button onClick={() => setSecurityMode('reveal')} className="flex w-full py-4 px-3 hover:bg-white/5 transition-all rounded-2xl group">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-400"><ShieldCheck className="w-5 h-5" /></div>
                                        <div className="text-left"><p className="text-sm font-bold text-white/90">Show Recovery Phrase</p><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Master Secret Key</p></div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em] px-2">Session Control</h2>
                        <div className="bg-red-500/[0.02] border border-red-500/10 rounded-[2.5rem] p-2 space-y-1">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button className="flex w-full py-4 px-3 hover:bg-red-500/10 transition-all rounded-2xl group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500 group-hover:scale-110 transition-transform"><Trash2 className="w-5 h-5" /></div>
                                            <div className="text-left"><p className="text-sm font-bold text-red-500">Purge Local Keys</p><p className="text-[10px] text-red-500/60 uppercase tracking-widest font-black opacity-60">Immediate Removal</p></div>
                                        </div>
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-black border-red-500/20 rounded-[2.5rem] shadow-2xl">
                                    <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-white">Purge Local Cache?</AlertDialogTitle><AlertDialogDescription className="text-zinc-400">This will permanently remove the secret phrase from this device. Access can only be restored via Cloud Vault.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter className="mt-6 gap-2"><AlertDialogCancel className="rounded-2xl h-14 bg-white/5">Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteWallet} className="bg-red-500 rounded-2xl h-14 font-black">Yes, Purge Node</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <button onClick={() => setSecurityMode('destroy')} className="flex w-full py-4 px-3 hover:bg-red-500/10 transition-all rounded-2xl group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500 group-hover:scale-110 transition-transform"><ShieldAlert className="w-5 h-5" /></div>
                                    <div className="text-left"><p className="text-sm font-bold text-red-500">Destroy Cloud Vault</p><p className="text-[10px] text-red-500/60 uppercase tracking-widest font-black opacity-60">Permanent Global Removal</p></div>
                                </div>
                            </button>

                            <button onClick={handleLogout} className="flex w-full py-4 px-3 hover:bg-red-500/10 transition-all rounded-2xl group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500">
                                        {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldX className="w-5 h-5" />}
                                    </div>
                                    <div className="text-left"><p className="text-sm font-bold text-red-500">Log Out & Terminate</p><p className="text-[10px] text-red-500/60 uppercase tracking-widest font-black opacity-60">End Node Session</p></div>
                                </div>
                            </button>
                        </div>
                    </section>
                </div>
            </main>

            <AlertDialog open={securityMode !== 'idle'} onOpenChange={(open) => !open && resetSecurityFlow()}>
                <AlertDialogContent className="bg-[#0a0a0c] border-white/10 rounded-[2.5rem] p-8 max-w-[95vw] sm:max-w-[400px]">
                    <AlertDialogHeader className="space-y-4">
                        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto", securityMode === 'destroy' ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary")}>
                            {securityMode === 'destroy' ? <ShieldAlert className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
                        </div>
                        <AlertDialogTitle className="text-2xl font-black text-center text-white">Identity Verification</AlertDialogTitle>
                    </AlertDialogHeader>
                    {!isVerified ? (
                        <div className="mt-6 space-y-4">
                            <Input type="password" placeholder="Enter your password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="h-14 bg-white/5 rounded-2xl" />
                            <Button className="w-full h-14 rounded-2xl font-black bg-primary" onClick={handleVerifyPassword} disabled={isVerifying}>{isVerifying ? <Loader2 className="animate-spin" /> : "Verify"}</Button>
                        </div>
                    ) : (
                        <div className="mt-6">
                            {securityMode === 'reveal' && (
                                <div className="space-y-4">
                                    <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 font-mono text-center text-sm break-words text-white">
                                        {mnemonic || "No phrase detected in local registry."}
                                    </div>
                                    <Button variant="outline" className="w-full h-14 rounded-2xl font-black text-xs uppercase" onClick={() => {
                                        navigator.clipboard.writeText(mnemonic || '');
                                        toast({ title: "Copied to clipboard" });
                                    }} disabled={!mnemonic}>Copy Phrase</Button>
                                </div>
                            )}
                            {securityMode === 'destroy' && (
                                <div className="space-y-4">
                                    <Input placeholder="Type DELETE" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} className="h-14 text-center font-black" />
                                    <Button className="w-full h-14 rounded-2xl bg-red-500 font-black" onClick={handlePermanentDestroy} disabled={confirmInput !== 'DELETE' || isDestroying}>Confirm Destruction</Button>
                                </div>
                            )}
                        </div>
                    )}
                    <AlertDialogFooter className="mt-8"><AlertDialogCancel className="rounded-2xl h-14 bg-white/5" onClick={resetSecurityFlow}>Cancel</AlertDialogCancel></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Sheet open={isCurrencySheetOpen} onOpenChange={setIsCurrencySheetOpen}>
                <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[3.5rem] h-[80vh]">
                    <div className="w-12 h-1 bg-white/10 rounded-full mx-auto my-4" />
                    <ScrollArea className="h-full px-6 pb-20">
                        {sortedCurrencies.map(code => (
                            <button key={code} onClick={() => { setCurrency(code); setIsCurrencySheetOpen(false); }} className="w-full py-4 text-left font-bold text-white border-b border-white/5">{code}</button>
                        ))}
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
    );
}
