
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getDirectLogoUrl } from '@/lib/getTokenLogo';
import { registryDb } from '@/lib/storage/registry-db';

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
 * Version: 4.0.0 (Persistent Handshake)
 * Optimized for zero-latency hydration via IndexedDB.
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
    return `logo_v9_${slug}_${sym}`;
  }, [name, symbol, alt]);

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const handshakeAttempted = useRef(false);

  useEffect(() => {
    async function resolve() {
      if (handshakeAttempted.current) return;
      
      setIsLoading(true);
      setHasError(false);

      // 1. CHECK PERSISTENT REGISTRY (IndexedDB)
      // Millisecond-latency check for existing branding
      const cached = await registryDb.getLogo(cacheKey);
      if (cached) {
        setResolvedUrl(cached);
        setIsLoading(false);
        handshakeAttempted.current = true;
        return;
      }

      // 2. PRIMARY: Metadata URL Check
      if (typeof logoUrl === 'string' && logoUrl.length > 0) {
        let finalUrl = logoUrl;
        // Prepend institutional CDN base for relative paths
        if (logoUrl.startsWith('/api/cdn') || !logoUrl.startsWith('http')) {
          const base = 'https://gcghriodmljkusdduhzl.supabase.co';
          finalUrl = `${base}${logoUrl.startsWith('/') ? logoUrl : '/' + logoUrl}`;
        }
        
        setResolvedUrl(finalUrl);
        await registryDb.saveLogo(cacheKey, finalUrl);
        setIsLoading(false);
        handshakeAttempted.current = true;
        return;
      }

      // 3. SECONDARY: Server Handshake (Fallback Discovery)
      if (name || symbol) {
        try {
          const direct = await getDirectLogoUrl(name || '', symbol || '');
          if (direct) {
            setResolvedUrl(direct);
            await registryDb.saveLogo(cacheKey, direct);
            setIsLoading(false);
            handshakeAttempted.current = true;
            return;
          }
        } catch (e) {
          console.warn("[LOGO_REGISTRY] Handshake deferred.");
        }
      }

      setIsLoading(false);
      handshakeAttempted.current = true;
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
        className={cn("rounded-full object-cover bg-white/5", className)}
        unoptimized
        onError={() => setHasError(true)}
      />
    </div>
  );
}
