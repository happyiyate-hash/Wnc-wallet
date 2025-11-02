import Link from "next/link";

export default function BuyPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-4xl font-bold mb-4">Buy Crypto</h1>
            <p className="text-muted-foreground mb-8">This is where the Buy functionality will live.</p>
            <Link href="/" className="text-primary hover:underline">Go back home</Link>
        </div>
    );
}
