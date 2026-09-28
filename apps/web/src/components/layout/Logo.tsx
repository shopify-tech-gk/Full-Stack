import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  priority?: boolean;
  /** Live mobile header uses a separate, wider logo asset (138x65 rendered). */
  variant?: 'default' | 'mobile';
}

// Live assets: desktop/tablet logo 666x375 (/logo.png); mobile logo ~2.12:1 (/logo-mobile.png).
export function Logo({ className, priority, variant = 'default' }: LogoProps) {
  const mobile = variant === 'mobile';
  return (
    <Link href="/" aria-label="YouMart home" className={`block shrink-0 ${className ?? ''}`}>
      <Image
        src={mobile ? '/logo-mobile.png' : '/logo.png'}
        alt="YouMart - Shop Easy Live Better"
        width={mobile ? 552 : 666}
        height={mobile ? 260 : 375}
        priority={priority}
        className="h-auto w-full"
      />
    </Link>
  );
}
