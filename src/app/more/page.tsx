'use client';

import { useState } from 'react';
import ApiKeyManager from '@/components/wallet/api-key-manager';
import { Button } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';

export default function MorePage() {
    const [isApiManagerOpen, setIsApiManagerOpen] = useState(false);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md">
                <h1 className="text-3xl font-bold mb-6 text-center">More Options</h1>
                <div className="space-y-4">
                    <Button 
                        variant="outline" 
                        className="w-full h-14 text-lg justify-start p-4"
                        onClick={() => setIsApiManagerOpen(true)}
                    >
                        <KeyRound className="mr-3 h-5 w-5 text-primary" />
                        <span>Manage API Keys</span>
                    </Button>
                    {/* Other "More" options can be added here */}
                </div>
            </div>
            <ApiKeyManager 
                isOpen={isApiManagerOpen} 
                onOpenChange={setIsApiManagerOpen} 
            />
        </div>
    );
}