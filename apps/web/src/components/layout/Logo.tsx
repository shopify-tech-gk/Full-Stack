import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  priority?: boolean;
  /** Live mobile header renders the logo ~138px wide (variant kept for future divergence). */
  variant?: 'default' | 'mobile';
}

// Real logo from youmartshop.com (new-logo-youmart-m-1, 500x199). The live header uses the
// same asset on desktop and mobile; kept as two public files so each variant can diverge later.
export function Logo({ className, priority, variant = 'default' }: LogoProps) {
  const mobile = variant === 'mobile';
  return (
    <Link href="/" aria-label="YouMart home" className={`block shrink-0 ${className ?? ''}`}>
      <Image
        src={mobile ? '/logo-mobile.png' : '/logo.png'}
        alt="YouMart - shop online, Live better"
        width={500}
        height={199}
        priority={priority}
        className="h-auto w-full"
      />
    </Link>
  );
}
