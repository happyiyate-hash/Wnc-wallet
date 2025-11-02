'use client';
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function TokenDetailsPage() {
    const searchParams = useSearchParams();
    const tokenSymbol = searchParams.get('symbol');

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-4xl font-bold mb-4">Token Details</h1>
            <p className="text-muted-foreground mb-8">Details for token: {tokenSymbol}</p>
            <Link href="/" className="text-primary hover:underline">Go back home</Link>
        </div>
    );
}
