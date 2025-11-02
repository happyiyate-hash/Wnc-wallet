'use client';
import Image from "next/image";
import type { ImageProps } from "next/image";

// Simple wrapper around Next.js Image component for now.
// Can be extended with caching logic later if needed.
export default function CachedImage(props: ImageProps) {
  return <Image {...props} alt={props.alt} />;
}
