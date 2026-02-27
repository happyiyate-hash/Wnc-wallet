'use client';

import React from 'react';

/**
 * SHARED NAVIGATION GRADIENT
 * Defines the canonical #nav-icon-gradient used by all terminal navigation nodes.
 */
export const NavGradient = () => (
  <svg width="0" height="0" className="absolute pointer-events-none">
    <defs>
      <linearGradient id="nav-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#818cf8" />
        <stop offset="100%" stopColor="#c084fc" />
      </linearGradient>
    </defs>
  </svg>
);
