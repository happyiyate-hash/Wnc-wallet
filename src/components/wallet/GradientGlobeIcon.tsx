import React from 'react';

const GradientGlobeIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M21.5 12C21.5 17.5228 17.5228 22 12 22C6.47715 22 2.5 17.5228 2.5 12C2.5 6.47715 6.47715 2 12 2C17.5228 2 21.5 6.47715 21.5 12Z" stroke="url(#nav-icon-gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2.5 12H21.5" stroke="url(#nav-icon-gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 2.5C14.5011 5.23838 15.9228 8.52904 16 12C15.9228 15.471 14.5011 18.7616 12 21.5C9.49886 18.7616 8.07725 15.471 8 12C8.07725 8.52904 9.49886 5.23838 12 2.5Z" stroke="url(#nav-icon-gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default GradientGlobeIcon;
