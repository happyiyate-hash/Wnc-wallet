'use client';

import CachedImage from '../CachedImage';
import { Skeleton } from '../ui/skeleton';

interface TokenLogoDynamicProps {
  logoUrl: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  FallbackComponent?: React.ReactElement;
}

export default function TokenLogoDynamic({
  logoUrl,
  alt,
  size = 32,
  className,
  FallbackComponent,
}: TokenLogoDynamicProps) {
  
  // If logoUrl is explicitly null, it means we tried fetching but found no logo.
  if (logoUrl === null) {
      return FallbackComponent || <div className={`w-[${size}px] h-[${size}px] rounded-full bg-muted ${className}`} />;
  }

  // If logoUrl is undefined, it means we are still in a loading state.
  if (logoUrl === undefined) {
    return <Skeleton className={`w-[${size}px] h-[${size}px] rounded-full ${className}`} />;
  }

  // If we have a logoUrl, display the image.
  return (
    <CachedImage
      src={logoUrl}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      unoptimized
    />
  );
}
