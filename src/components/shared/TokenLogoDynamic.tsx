
'use client';

import { useEffect, useState, useMemo } from 'react';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getDirectLogoUrl } from '@/lib/getTokenLogo';

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

const CDN_BASE_URL = 'https://gcghriodmljkusdduhzl.supabase.co';

/**
 * INSTITUTIONAL TOKEN LOGO ENGINE (CACHED)
 * Features Synchronous Cache Hydration to eliminate UI flickering.
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
  // 1. DETERMINISTIC CACHE KEY
  const cacheKey = useMemo(() => {
    const slug = (name || alt || '').replace(/\s+/g, '_').toLowerCase();
    return `logo_v3_${slug}_${symbol?.toLowerCase() || 'native'}`;
  }, [name, symbol, alt]);

  // 2. SYNCHRONOUS HYDRATION (Client-Only)
  // We initialize state from localStorage if available to prevent the 1st-render flicker
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
      // If we already have a cached URL, don't trigger a loading state
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        setIsLoading(true);
      } else {
        setResolvedUrl(cached);
        setIsLoading(false);
      }
      
      setHasError(false);

      // A. If already cached, we can skip the heavy Supabase lookup
      if (cached) return;

      // B. Perform direct Supabase registry lookup
      if (symbol || name) {
        try {
          const direct = await getDirectLogoUrl(name || '', symbol || '');
          if (direct) {
            setResolvedUrl(direct);
            localStorage.setItem(cacheKey, direct); 
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[LOGO_CACHE_ADVISORY] Registry lookup failed:", e);
        }
      }

      // C. Fallback to provided URL nodes
      if (logoUrl) {
        let finalUrl = logoUrl;
        if (logoUrl.startsWith('http')) {
          finalUrl = logoUrl;
        } else if (logoUrl.startsWith('/')) {
          finalUrl = `${CDN_BASE_URL}${logoUrl}`;
        }
        
        setResolvedUrl(finalUrl);
        localStorage.setItem(cacheKey, finalUrl);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    }

    resolve();
  }, [logoUrl, symbol, name, cacheKey]);

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
