'use client';

import { useEffect, useState, useMemo } from 'react';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getDirectLogoUrl } from '@/lib/getTokenLogo';
import { LOGO_CDN_URL } from '@/lib/supabase/logo-client';

interface TokenLogoDynamicProps {
  logoUrl: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  FallbackComponent?: React.ReactElement;
  chainId?: number;
  symbol?: string; 
  name?: string;
}

/**
 * INSTITUTIONAL TOKEN LOGO ENGINE (TYPE-SAFE)
 * Version: 5.1.0 (Guide Compliant)
 * 
 * Handles relative path resolution by prepending the CDN URL
 * and ensures strict string checking to prevent TypeErrors.
 */
export default function TokenLogoDynamic({
  logoUrl,
  alt,
  size = 32,
  className,
  FallbackComponent,
  symbol,
  name,
}: TokenLogoDynamicProps) {
  const cacheKey = useMemo(() => {
    const slug = (name || alt || '').replace(/\s+/g, '_').toLowerCase();
    const sym = symbol?.toLowerCase() || 'native';
    return `logo_v5.1_${slug}_${sym}`;
  }, [name, symbol, alt]);

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(cacheKey);
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(!resolvedUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function resolve() {
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        if (resolvedUrl !== cached) setResolvedUrl(cached);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      // 1. PRIMARY: Direct Path Resolution (Strict String Check)
      if (logoUrl && typeof logoUrl === 'string') {
        let finalUrl = logoUrl;
        if (logoUrl.startsWith('/api/cdn')) {
          finalUrl = `${LOGO_CDN_URL}${logoUrl}`;
        } else if (!logoUrl.startsWith('http')) {
          // If relative but not starting with /api/cdn, treat as institutional path
          finalUrl = `${LOGO_CDN_URL}${logoUrl.startsWith('/') ? logoUrl : '/' + logoUrl}`;
        }
        
        setResolvedUrl(finalUrl);
        localStorage.setItem(cacheKey, finalUrl);
        setIsLoading(false);
        return;
      }

      // 2. SECONDARY: Server Handshake (Prioritized Search)
      if (name || symbol) {
        try {
          const direct = await getDirectLogoUrl(name || '', symbol || '');
          if (direct) {
            setResolvedUrl(direct);
            localStorage.setItem(cacheKey, direct); 
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[LOGO_CLIENT_ADVISORY] Registry handshake deferred.");
        }
      }

      setIsLoading(false);
    }

    resolve();
  }, [logoUrl, symbol, name, cacheKey, resolvedUrl]);

  if (isLoading && !resolvedUrl) {
    return <Skeleton className={`rounded-full bg-white/5 animate-pulse`} style={{ width: size, height: size }} />;
  }

  if (!resolvedUrl || hasError) {
    return FallbackComponent || <GenericCoinIcon size={size} className={className} />;
  }

  return (
    <div style={{ width: size, height: size }} className="shrink-0 flex items-center justify-center">
      <CachedImage
        src={resolvedUrl}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full object-cover bg-white/5 ${className}`}
        unoptimized
        onError={() => setHasError(true)}
      />
    </div>
  );
}
