import React from 'react';

const GenericCoinIcon = ({ size = 32, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    <path
      d="M12 6V18M15.5 9.5C15.5 8.11929 13.9423 7 12 7C10.0577 7 8.5 8.11929 8.5 9.5C8.5 10.8807 10.0577 12 12 12M15.5 14.5C15.5 15.8807 13.9423 17 12 17C10.0577 17 8.5 15.8807 8.5 14.5C8.5 13.1193 10.0577 12 12 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default GenericCoinIcon;
