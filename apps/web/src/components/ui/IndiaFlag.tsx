interface IndiaFlagProps {
  className?: string;
}

/** India's tricolour with the Ashoka Chakra, 3:2 (live's GTranslate shows it for Indian languages). */
export function IndiaFlag({ className = '' }: IndiaFlagProps) {
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true" className={className}>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.6" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </svg>
  );
}
