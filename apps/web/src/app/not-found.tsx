import Link from 'next/link';
import { NOT_FOUND_PAGE, ROUTES } from '@youmart/shared-client';
import { SearchBar } from '@/components/layout/SearchBar';

const LINKS = [
  { href: ROUTES.home, label: 'Home' },
  { href: ROUTES.shop, label: 'Shop' },
  { href: ROUTES.trackOrder, label: 'Track Order' },
  { href: ROUTES.customerCare, label: 'Customer Care' },
] as const;

// Live 404: centred brand-blue Outfit 32px title, one line of copy, a search box.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-[760px] px-[20px] py-[60px] text-center lg:py-[100px]">
      <p
        aria-hidden="true"
        className="font-ui text-[72px] font-bold leading-none text-brand/15 lg:text-[120px]"
      >
        404
      </p>
      <h1 className="mt-[10px] font-ui text-[24px] font-normal leading-[1.3] text-brand lg:text-[32px]">
        {NOT_FOUND_PAGE.title}
      </h1>
      <p className="mt-[16px] font-ui text-[14.6px] leading-[1.6] text-ink-body lg:text-[16px]">
        {NOT_FOUND_PAGE.text}
      </p>
      <SearchBar id="search-404" className="mx-auto mt-[24px] max-w-[480px] text-left" />
      <nav aria-label="Helpful links" className="mt-[30px]">
        <ul className="flex flex-wrap justify-center gap-[10px]">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex h-[40px] items-center rounded-full border-2 border-brand px-[20px] font-ui text-[14px] font-semibold text-brand transition-colors hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
