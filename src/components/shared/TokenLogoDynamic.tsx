'use client';

import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';
import { useWallet } from '@/contexts/wallet-provider';
import GenericCoinIcon from '../icons/GenericCoinIcon';
import { getTokenLogoUrl } from '@/lib/getTokenLogo';
import { useEffect, useState } from 'react';

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

export default function TokenLogoDynamic({
  logoUrl,
  alt,
  size = 32,
  className,
  FallbackComponent,
  chainId,
  symbol,
  name,
}: TokenLogoDynamicProps) {
  const { allChainsMap } = useWallet();
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (logoUrl === undefined && !symbol) {
    return <Skeleton className={`w-[${size}px] h-[${size}px] rounded-full ${className}`} />;
  }

  let finalUrl = logoUrl;
  
  // Handle relative paths from the Wevina CDN API
  if (finalUrl && finalUrl.startsWith('/api/cdn')) {
    finalUrl = `${origin}${finalUrl}`;
  }

  // Fallback to predicted path if no URL provided but symbol is known
  if (!finalUrl && symbol) {
    const predicted = getTokenLogoUrl(symbol, name);
    if (predicted) {
        finalUrl = `${origin}${predicted}`;
    }
  }

  // Native token icon fallback from chain config
  if (!finalUrl && chainId && allChainsMap[chainId]) {
    const nativeChainIcon = allChainsMap[chainId].iconUrl;
    if (nativeChainIcon) {
      finalUrl = nativeChainIcon.startsWith('http') ? nativeChainIcon : `${origin}${nativeChainIcon}`;
    }
  }

  if (!finalUrl || finalUrl.includes('undefined')) {
    return FallbackComponent || <GenericCoinIcon size={size} className={className} />;
  }

  return (
    <CachedImage
      src={finalUrl}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-white/5 ${className}`}
      unoptimized
    />
  );
}
