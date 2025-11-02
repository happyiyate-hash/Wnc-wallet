import Link from "next/link";

export default function AddTokenPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-4xl font-bold mb-4">Add Token</h1>
            <p className="text-muted-foreground mb-8">This is where you can add a new token.</p>
            <Link href="/" className="text-primary hover:underline">Go back home</Link>
        </div>
    );
}
