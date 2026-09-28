interface CaretProps {
  className?: string;
}

/** Small solid down-triangle, as used by the site's language pill and mobile drawer. */
export function Caret({ className = '' }: CaretProps) {
  return (
    <svg viewBox="0 0 10 6" aria-hidden="true" className={className} fill="currentColor">
      <path d="M0 0h10L5 6z" />
    </svg>
  );
}
