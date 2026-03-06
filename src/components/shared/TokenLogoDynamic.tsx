
'use client';

import { useEffect, useState, useMemo } from 'react';
import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getDirectLogoUrl } from '@/lib/getTokenLogo';
import { LOGO_CDN_URL } from '@/lib/supabase/logo-client';
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
 * INSTITUTIONAL TOKEN LOGO ENGINE (PERSISTENT)
 * Version: 6.0.0 (IndexedDB Registry)
 * 
 * Uses IndexedDB logo_registry for high-speed branding persistence.
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
    return `logo_v6_${slug}_${sym}`;
  }, [name, symbol, alt]);

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function resolve() {
      setIsLoading(true);
      setHasError(false);

      // 1. CHECK PERSISTENT REGISTRY (IndexedDB)
      const cached = await registryDb.getLogo(cacheKey);
      if (cached) {
        setResolvedUrl(cached);
        setIsLoading(false);
        return;
      }

      // 2. PRIMARY: Direct Path Resolution
      if (logoUrl && typeof logoUrl === 'string') {
        let finalUrl = logoUrl;
        if (logoUrl.startsWith('/api/cdn')) {
          finalUrl = `${LOGO_CDN_URL}${logoUrl}`;
        } else if (!logoUrl.startsWith('http')) {
          finalUrl = `${LOGO_CDN_URL}${logoUrl.startsWith('/') ? logoUrl : '/' + logoUrl}`;
        }
        
        setResolvedUrl(finalUrl);
        await registryDb.saveLogo(cacheKey, finalUrl);
        setIsLoading(false);
        return;
      }

      // 3. SECONDARY: Server Handshake
      if (name || symbol) {
        try {
          const direct = await getDirectLogoUrl(name || '', symbol || '');
          if (direct) {
            setResolvedUrl(direct);
            await registryDb.saveLogo(cacheKey, direct);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[LOGO_REGISTRY] Discovery deferred.");
        }
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
