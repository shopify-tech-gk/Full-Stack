import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  priority?: boolean;
}

// Placeholder asset at /public/logo.png (330x124); the real logo drops in at the same path.
export function Logo({ className, priority }: LogoProps) {
  return (
    <Link href="/" aria-label="YouMart home" className={className}>
      <Image
        src="/logo.png"
        alt="YouMart - Shop Easy Live Better"
        width={330}
        height={124}
        priority={priority}
        className="h-auto w-full"
      />
    </Link>
  );
}
