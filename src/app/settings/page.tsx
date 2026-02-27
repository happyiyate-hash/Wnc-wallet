
'use client';

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/wallet-provider";
import { useUser } from "@/contexts/user-provider";
import { useCurrency } from "@/contexts/currency-provider";
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
  UserCircle,
  ChevronRight,
  ShieldCheck,
  Settings2,
  Eye,
  Lock,
  User,
  Search,
  Check,
  Loader2,
  ShieldX
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SettingsPage() {
    const { wallets, deleteWallet, logout } = useWallet();
    const { user, profile } = useUser();
    const { selectedCurrency, setCurrency, rates, currentSymbol } = useCurrency();
    const { toast } = useToast();
    const router = useRouter();

    const [showPhrase, setShowPhrase] = useState(false);
    const [mnemonic, setMnemonic] = useState<string | null>(null);
    const [isCurrencySheetOpen, setIsCurrencySheetOpen] = useState(false);
    const [currencySearch, setCurrencySearch] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        if (user) {
            const saved = localStorage.getItem(`wallet_mnemonic_${user.id}`);
            setMnemonic(saved);
        }
    }, [user]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
            toast({ title: "Session Terminated", description: "Identity and keys have been purged safely." });
            router.push('/');
        } catch (e) {
            toast({ title: "Logout Error", description: "Failed to clear session. Please try again.", variant: "destructive" });
        } finally {
            setIsLoggingOut(false);
        }
    };

    const sortedCurrencies = useMemo(() => {
        const codes = Object.keys(rates).sort();
        const popular = ['USD', 'NGN', 'EUR', 'GBP', 'KES', 'GHS', 'ZAR'];
        const filtered = codes.filter(c => c.toLowerCase().includes(currencySearch.toLowerCase()));
        
        // Push popular to top
        const results = [...new Set([...popular.filter(p => filtered.includes(p)), ...filtered])];
        return results;
    }, [rates, currencySearch]);

    const SettingItem = ({ 
        icon: Icon, 
        label, 
        value, 
        onClick, 
        href, 
        destructive,
        iconBg = "bg-primary/10",
        iconColor = "text-primary"
    }: {
        icon: any;
        label: string;
        value?: string;
        onClick?: () => void;
        href?: string;
        destructive?: boolean;
        iconBg?: string;
        iconColor?: string;
    }) => {
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

        if (href) return (
            <Link href={href} className="flex py-4 px-3 hover:bg-white/5 transition-all rounded-2xl">
                {Content}
            </Link>
        );

        return (
            <button onClick={onClick} className="flex w-full py-4 px-3 hover:bg-white/5 transition-all rounded-2xl">
                {Content}
            </button>
        );
    };

    const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Institutional User';
    const handleTag = profile?.account_number ? `@${profile.account_number}` : user?.email;

    return (
        <div className="flex flex-col h-screen bg-[#050505] text-foreground relative overflow-hidden">
            {/* BRAND WATERMARK */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none">
                <div className="text-[40rem] font-black italic transform -rotate-12">W</div>
            </div>

            <header className="p-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex flex-col items-center">
                    <h1 className="text-xs font-black uppercase tracking-[0.2em] leading-none text-white/90">Institutional Settings</h1>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <Settings2 className="w-2.5 h-2.5 text-primary" />
                        <span className="text-[8px] text-primary font-black uppercase tracking-tighter">System Preferences</span>
                    </div>
                </div>
                <div className="w-10" />
            </header>

            <main className="flex-1 overflow-y-auto thin-scrollbar pb-32 relative z-10">
                <div className="max-w-2xl mx-auto p-6 space-y-8">
                    
                    {/* ACCOUNT & IDENTITY */}
                    <section className="space-y-3">
                        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Account & Identity</h2>
                        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-2 space-y-1">
                            <div className="p-5 flex items-center gap-4 border-b border-white/5 mb-1 bg-white/[0.02] rounded-[2rem]">
                                <div className="relative">
                                    <Avatar className="w-16 h-16 rounded-[1.5rem] border-2 border-primary/20 shadow-2xl">
                                        <AvatarImage src={profile?.photo_url} className="object-cover" />
                                        <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white rounded-[1.5rem]">
                                            <User className="w-8 h-8" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-[#0a0a0c] rounded-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-lg text-white truncate">{displayName}</p>
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60 truncate">{handleTag}</p>
                                </div>
                            </div>
                            <SettingItem 
                                icon={Globe} 
                                label="Display Currency" 
                                value={`${selectedCurrency} (${currentSymbol})`} 
                                iconBg="bg-blue-500/10" 
                                iconColor="text-blue-400" 
                                onClick={() => setIsCurrencySheetOpen(true)} 
                            />
                            <SettingItem 
                                icon={UserCircle} 
                                label="Switch Account" 
                                value="Main Vault" 
                                iconBg="bg-emerald-500/10" 
                                iconColor="text-emerald-400" 
                                onClick={() => toast({ title: "Account switching coming soon" })} 
                            />
                        </div>
                    </section>

                    {/* SECURITY & PRIVACY */}
                    <section className="space-y-3">
                        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Security & Privacy</h2>
                        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-2 space-y-1">
                            <SettingItem 
                                icon={KeyRound} 
                                label="Manage API Keys" 
                                value="Infura / Network RPCs" 
                                iconBg="bg-orange-500/10" 
                                iconColor="text-orange-400" 
                                href="/settings/api-keys" 
                            />
                            
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button className="flex w-full py-4 px-3 hover:bg-white/5 transition-all rounded-2xl group">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-400">
                                                    <ShieldCheck className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-white/90">Show Recovery Phrase</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Master Secret Key</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-[#0a0a0c] border-white/10 rounded-[2.5rem] p-8 max-w-[95vw] sm:max-w-[400px] shadow-2xl">
                                    <AlertDialogHeader className="space-y-4">
                                        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                                            <ShieldAlert className="w-8 h-8" />
                                        </div>
                                        <AlertDialogTitle className="text-2xl font-black text-center text-white">Security Check</AlertDialogTitle>
                                        <AlertDialogDescription className="text-center text-zinc-400 leading-relaxed font-medium">
                                            Never share your recovery phrase. It gives <span className="text-red-400 font-black underline">complete control</span> over your assets.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    
                                    <div className="mt-6 p-6 rounded-3xl bg-white/[0.03] border border-white/5 relative overflow-hidden group">
                                        <div className={cn(
                                            "text-center font-mono text-sm leading-loose tracking-wide transition-all duration-700 blur-xl select-none", 
                                            showPhrase && "blur-none select-text text-white"
                                        )}>
                                            {mnemonic || "No institutional phrase found on this node."}
                                        </div>
                                        {!showPhrase && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md">
                                                <Button 
                                                    variant="secondary" 
                                                    className="rounded-2xl h-12 gap-3 font-black px-6 shadow-2xl bg-white text-black hover:bg-zinc-200"
                                                    onClick={() => setShowPhrase(true)}
                                                >
                                                    <Eye className="w-4 h-4" /> Reveal Secret
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <AlertDialogFooter className="mt-8">
                                        <AlertDialogCancel className="rounded-2xl h-14 bg-white/5 border-white/10 font-bold" onClick={() => setShowPhrase(false)}>Done & Secure</AlertDialogCancel>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </section>

                    {/* DANGER ZONE */}
                    <section className="space-y-3">
                        <h2 className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em] px-2">Session Control</h2>
                        <div className="bg-red-500/[0.02] border border-red-500/10 rounded-[2.5rem] p-2 space-y-1">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button className="flex w-full py-4 px-3 hover:bg-red-500/10 transition-all rounded-2xl group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500 group-hover:scale-110 transition-transform">
                                                <Trash2 className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-red-500">Purge Local Keys</p>
                                                <p className="text-[10px] text-red-500/60 uppercase tracking-widest font-black opacity-60">Immediate Removal</p>
                                            </div>
                                        </div>
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-black border-red-500/20 rounded-[2.5rem] shadow-red-500/10 shadow-2xl">
                                    <AlertDialogHeader className="space-y-3">
                                        <AlertDialogTitle className="text-2xl font-black text-white">Purge Local Cache?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-zinc-400 font-medium">
                                            This will permanently remove the secret phrase from this device. Access can only be restored via <span className="text-primary font-bold">Cloud Vault</span> or manual import.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-6 gap-2">
                                        <AlertDialogCancel className="rounded-2xl h-14 bg-white/5">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={deleteWallet} className="bg-red-500 hover:bg-red-600 rounded-2xl h-14 font-black">Yes, Purge Node</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button className="flex w-full py-4 px-3 hover:bg-red-500/10 transition-all rounded-2xl group">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500 group-hover:scale-110 transition-transform">
                                                    {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldX className="w-5 h-5" />}
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-red-500">Log Out & Terminate</p>
                                                    <p className="text-[10px] text-red-500/60 uppercase tracking-widest font-black opacity-60">End SmarterSeller Session</p>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-black border-red-500/20 rounded-[2.5rem] shadow-red-500/10 shadow-2xl">
                                    <AlertDialogHeader className="space-y-3">
                                        <AlertDialogTitle className="text-2xl font-black text-white">Terminate Session?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-zinc-400 font-medium">
                                            This will clear your credentials from this device and end your active SmarterSeller session. You will need to sign in again to access your vault.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-6 gap-2">
                                        <AlertDialogCancel className="rounded-2xl h-14 bg-white/5">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleLogout} className="bg-red-500 hover:bg-red-600 rounded-2xl h-14 font-black">Yes, Terminate</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </section>
                </div>
            </main>

            {/* CURRENCY SELECTION SHEET */}
            <Sheet open={isCurrencySheetOpen} onOpenChange={setIsCurrencySheetOpen}>
                <SheetContent side="bottom" className="bg-[#0a0a0c] border-t border-primary/20 rounded-t-[3.5rem] p-0 h-[80vh] overflow-hidden flex flex-col">
                    <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
                    <SheetHeader className="px-6 pb-4 shrink-0">
                        <SheetTitle className="text-2xl font-black uppercase tracking-widest text-center">Select Currency</SheetTitle>
                        <div className="relative mt-4">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search currency..." 
                                className="h-12 bg-white/5 border-white/10 pl-11 rounded-2xl focus-visible:ring-primary"
                                value={currencySearch}
                                onChange={(e) => setCurrencySearch(e.target.value)}
                            />
                        </div>
                    </SheetHeader>
                    
                    <ScrollArea className="flex-1 px-4">
                        <div className="space-y-1 pb-24">
                            {sortedCurrencies.map((code) => (
                                <button 
                                    key={code} 
                                    onClick={() => { setCurrency(code); setIsCurrencySheetOpen(false); }}
                                    className={cn(
                                        "w-full flex items-center justify-between p-4 rounded-2xl transition-all group",
                                        selectedCurrency === code ? "bg-primary/10 border border-primary/20" : "hover:bg-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center font-bold text-sm text-primary">
                                            {code.slice(0, 2)}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-white">{code}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Global Fiat Rate</p>
                                        </div>
                                    </div>
                                    {selectedCurrency === code ? (
                                        <Check className="w-5 h-5 text-primary" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
    );
}
