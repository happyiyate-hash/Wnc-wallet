"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Fingerprint, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

export default function SecurityTab() {
  const [securityFeatures, setSecurityFeatures] = useState([
    {
        icon: Fingerprint,
        title: "Two-Factor Authentication (2FA)",
        description: "Add an extra layer of security to your account.",
        enabled: true
    },
    {
        icon: ShieldAlert,
        title: "Phishing Protection",
        description: "We'll warn you about suspicious links and requests.",
        enabled: true
    },
    {
        icon: Lock,
        title: "Auto-Lock on Idle",
        description: "Automatically lock the wallet after 15 minutes.",
        enabled: false
    }
  ]);

  const handleToggle = (index: number) => {
    setSecurityFeatures(prev => 
        prev.map((feature, i) => 
            i === index ? { ...feature, enabled: !feature.enabled } : feature
        )
    );
  };

  return (
    <div className="mt-6 space-y-6">
        <Card className="shadow-lg border-none">
            <CardHeader>
                <CardTitle>Security Center</CardTitle>
                <CardDescription>Manage your wallet's security settings and alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <Alert className="bg-primary/5 border-primary/20">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-primary">No active security threats</AlertTitle>
                    <AlertDescription>
                        Your wallet is secure. We'll notify you here of any suspicious activity.
                    </AlertDescription>
                </Alert>

                <div className="space-y-4">
                    {securityFeatures.map((feature, index) => (
                        <div key={index} className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                            <div className="flex items-start gap-4">
                                <feature.icon className="h-6 w-6 text-muted-foreground mt-1" />
                                <div>
                                    <h3 className="font-semibold">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                            </div>
                            <Switch 
                                checked={feature.enabled}
                                onCheckedChange={() => handleToggle(index)}
                                aria-label={`Toggle ${feature.title}`}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
