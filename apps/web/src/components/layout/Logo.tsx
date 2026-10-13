import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  priority?: boolean;
  /** Live mobile header renders the logo ~138px wide (variant kept for future divergence). */
  variant?: 'default' | 'mobile';
}

// The YouMart logo ("Shop Easy, Live Better", 456x173, transparent). The header uses the same
// asset on desktop and mobile; kept as two public files so each variant can diverge later.
export function Logo({ className, priority, variant = 'default' }: LogoProps) {
  const mobile = variant === 'mobile';
  return (
    <Link href="/" aria-label="YouMart home" className={`block shrink-0 ${className ?? ''}`}>
      <Image
        src={mobile ? '/logo-mobile.png' : '/logo.png'}
        alt="YouMart - Shop Easy, Live Better"
        width={456}
        height={173}
        priority={priority}
        className="h-auto w-full"
      />
    </Link>
  );
}
