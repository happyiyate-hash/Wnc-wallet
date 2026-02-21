'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/wallet-provider";
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
import { Trash2, ShieldAlert, ArrowLeft, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const { wallets, deleteWallet } = useWallet();
    const { toast } = useToast();
    const router = useRouter();

    const handleDeleteWallet = () => {
        deleteWallet();
        toast({
            title: "Wallet Deleted",
            description: "Your local keys have been removed. You can now set up a new wallet.",
        });
        router.push('/');
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            <header className="p-4 flex items-center gap-2 border-b border-white/5">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-bold">Settings</h1>
            </header>

            <main className="flex-1 p-6 space-y-8 max-w-2xl mx-auto w-full overflow-y-auto">
                <section className="space-y-4">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2">Account & Access</h2>
                    <div className="space-y-2">
                        <Button asChild variant="outline" className="w-full h-16 justify-start rounded-2xl text-base gap-4 bg-white/5 border-white/10 hover:bg-white/10 transition-all" size="lg">
                            <Link href="/settings/api-keys">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                    <KeyRound className="w-5 h-5" />
                                </div>
                                Manage API Keys
                            </Link>
                        </Button>
                    </div>
                </section>

                <section className="space-y-4 pt-4">
                    <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest px-2">Security & Danger Zone</h2>
                    <div className="p-6 rounded-[2rem] bg-destructive/5 border border-destructive/10 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center text-destructive shrink-0">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-lg text-foreground">Purge Local Keys</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    This will permanently remove the secret phrase from this device's memory. 
                                    Make sure you have your backup secured in the Cloud Vault or written down.
                                </p>
                            </div>
                        </div>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    variant="destructive" 
                                    className="w-full h-14 rounded-2xl font-bold gap-3 shadow-lg shadow-destructive/20 active:scale-[0.98] transition-transform"
                                    disabled={!wallets}
                                >
                                    <Trash2 className="w-5 h-5" />
                                    Delete Local Wallet
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-[90vw] sm:max-w-[400px]">
                                <AlertDialogHeader className="space-y-3">
                                    <AlertDialogTitle className="text-2xl font-bold">Are you certain?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-zinc-400 text-sm leading-relaxed">
                                        Deleting local keys means you cannot access your assets on this device without re-importing. 
                                        If you haven't synced to your <span className="text-primary font-bold">Cloud Vault</span>, you might lose access permanently.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-8 gap-3 sm:flex-col">
                                    <AlertDialogAction 
                                        onClick={handleDeleteWallet}
                                        className="w-full bg-destructive hover:bg-destructive/90 h-14 rounded-2xl font-bold text-base"
                                    >
                                        Yes, Purge Wallet
                                    </AlertDialogAction>
                                    <AlertDialogCancel className="w-full rounded-2xl border-white/10 h-14 bg-white/5 hover:bg-white/10">
                                        Cancel
                                    </AlertDialogCancel>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </section>
            </main>
        </div>
    );
}
