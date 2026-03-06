'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getDirectLogoUrl } from '@/lib/getTokenLogo';
import { registryDb } from '@/lib/storage/registry-db';
import { cn } from '@/lib/utils';

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
 * INSTITUTIONAL LOGO ENGINE
 * Version: 7.0.0 (Cache-Strict Independent Discovery)
 * 
 * Logic:
 * 1. Calculate persistent cache key from asset signature.
 * 2. Check IndexedDB registry immediately.
 * 3. Serve cached URL instantly if found.
 * 4. Perform silent background discovery if cache miss.
 * 5. Decorate relative paths with institutional CDN base.
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
    return `logo_v12_${slug}_${sym}`;
  }, [name, symbol, alt]);

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    async function resolve() {
      // 1. INSTANT REGISTRY CHECK
      try {
        const cached = await registryDb.getLogo(cacheKey);
        if (cached) {
          setResolvedUrl(cached);
          setIsInitializing(false);
          return;
        }
      } catch (e) {
        // DB Handshake deferred
      }

      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      // 2. SILENT BACKGROUND DISCOVERY
      let finalUrl: string | null = null;

      // Normalize provided URL
      if (typeof logoUrl === 'string' && logoUrl.length > 0) {
        finalUrl = logoUrl;
        if (logoUrl.startsWith('/api/cdn') || !logoUrl.startsWith('http')) {
          const base = 'https://gcghriodmljkusdduhzl.supabase.co';
          finalUrl = `${base}${logoUrl.startsWith('/') ? logoUrl : '/' + logoUrl}`;
        }
      } 
      // Fallback: Global Registry Handshake
      else if (name || symbol) {
        try {
          finalUrl = await getDirectLogoUrl(name || '', symbol || '');
        } catch (e) {
          finalUrl = null;
        }
      }

      if (finalUrl) {
        setResolvedUrl(finalUrl);
        // Persist for zero-latency next reload
        await registryDb.saveLogo(cacheKey, finalUrl);
      }

      setIsInitializing(false);
      isFetchingRef.current = false;
    }

    resolve();
  }, [logoUrl, symbol, name, cacheKey]);

  // NON-BLOCKING UI: Show fallback while cache is priming
  if (isInitializing && !resolvedUrl) {
    return (
      <div style={{ width: size, height: size }} className={cn("shrink-0 flex items-center justify-center", className)}>
        <div className="w-full h-full rounded-full bg-white/[0.03] animate-pulse border border-white/5" />
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div style={{ width: size, height: size }} className={cn("shrink-0 flex items-center justify-center", className)}>
        {FallbackComponent || <GenericCoinIcon size={size} />}
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size }} className={cn("shrink-0 flex items-center justify-center relative overflow-hidden", className)}>
      <CachedImage
        src={resolvedUrl}
        alt={alt}
        width={size}
        height={size}
        className="rounded-full object-cover transition-opacity duration-300 opacity-0"
        unoptimized
        onLoad={(e) => {
          (e.target as HTMLImageElement).style.opacity = '1';
        }}
        onError={() => {
          setResolvedUrl(null);
          // Mark as invalid node in cache to prevent repeated failing handshakes
          registryDb.saveLogo(cacheKey, ''); 
        }}
      />
    </div>
  );
}
