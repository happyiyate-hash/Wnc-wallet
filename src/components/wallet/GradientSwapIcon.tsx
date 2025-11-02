import React from 'react';

const GradientSwapIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20 7L4 7" stroke="url(#nav-icon-gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 3L4 7L8 11" stroke="url(#nav-icon-gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 17L20 17" stroke="url(#nav-icon-gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 13L20 17L16 21" stroke="url(#nav-icon-gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default GradientSwapIcon;