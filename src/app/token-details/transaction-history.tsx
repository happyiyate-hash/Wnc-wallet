'use client';

import type { AssetRow } from "@/lib/types";

export default function TransactionHistory({ token }: { token: AssetRow }) {
    return (
        <div className="text-center py-8 text-muted-foreground">
            Transaction history will be shown here.
        </div>
    )
}