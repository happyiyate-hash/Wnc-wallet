import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md text-center">
                <h1 className="text-4xl font-bold mb-4">Settings</h1>
                <p className="text-muted-foreground mb-8">Manage your wallet and application settings.</p>
                <div className="flex flex-col gap-4">
                    <Button asChild variant="outline" size="lg">
                        <Link href="/settings/api-keys">Manage API Keys</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                        <Link href="/">Back to Wallet</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
