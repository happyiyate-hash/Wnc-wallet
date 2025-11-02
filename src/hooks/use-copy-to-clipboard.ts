"use client";

import { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

type CopyFn = (text: string) => Promise<boolean>;

export function useCopyToClipboard(): [boolean, CopyFn] {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const { toast } = useToast();

  const copy: CopyFn = useCallback(async (text) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported');
      toast({
        title: "Error",
        description: "Clipboard access is not supported or denied.",
        variant: "destructive",
      });
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast({
        title: "Copied to clipboard!",
      });
      return true;
    } catch (error) {
      console.warn('Copy failed', error);
      toast({
        title: "Copy Failed",
        description: "Could not copy text to clipboard.",
        variant: "destructive",
      });
      setIsCopied(false);
      return false;
    }
  }, [toast]);
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isCopied) {
      timeout = setTimeout(() => setIsCopied(false), 2000);
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [isCopied]);

  return [isCopied, copy];
}
