
import { Suspense } from 'react';
import ReceiveClientPage from './receive-client';
import { Loader2 } from 'lucide-react';

export default function ReceivePage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <ReceiveClientPage />
        </Suspense>
    )
}
