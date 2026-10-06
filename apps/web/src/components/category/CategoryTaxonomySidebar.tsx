import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import {
  EXPLORE_CATEGORY_PLACEHOLDER,
  type TaxonomyMain,
  type TaxonomyNode,
} from '@youmart/shared-client';
import { TileImage } from './TileImage';

const ROW =
  'flex items-center gap-[10px] rounded-[8px] px-[5px] py-[4px] font-sans text-[12.5px] leading-[1.3] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

/**
 * DESKTOP ONLY (>= 1025px): the listing page's sidebar in the redesign - the main category's card,
 * then its sub-categories, each expanding (no JS: <details>) to its sub-to-sub list. The branch
 * holding the current page starts open and the current page is highlighted.
 */
export function CategoryTaxonomySidebar({
  main,
  currentHref,
}: {
  main: TaxonomyMain;
  currentHref: string;
}) {
  const isCurrent = (node: TaxonomyNode) => node.match === 'catalog' && node.href === currentHref;

  return (
    <aside
      aria-labelledby="sidebar-main"
      className="sticky top-[10px] hidden max-h-[calc(100vh-20px)] w-[280px] shrink-0 self-start overflow-y-auto overscroll-contain rounded-[16px] border border-brand-popup-border bg-brand-popup-bg p-[10px] [scrollbar-width:thin] lg:block"
    >
      <Link
        href={main.href}
        aria-current={isCurrent(main) ? 'page' : undefined}
        className={`group block rounded-[12px] border bg-white p-[5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          isCurrent(main) ? 'border-brand' : 'border-cart-line'
        }`}
      >
        <Image
          src={main.image.desktop ?? EXPLORE_CATEGORY_PLACEHOLDER}
          alt=""
          width={960}
          height={300}
          sizes="270px"
          className="aspect-[16/5] w-full rounded-[8px] object-cover"
        />
        <span className="flex items-center justify-between gap-[6px] px-[4px] pb-[3px] pt-[8px]">
          <span
            id="sidebar-main"
            className="min-w-0 truncate font-ui text-[15px] font-semibold leading-[1.2] text-heading group-hover:text-brand"
          >
            {main.name}
          </span>
          <span
            aria-hidden="true"
            className="flex size-[19px] shrink-0 items-center justify-center rounded-full border border-brand text-brand transition-colors group-hover:bg-brand group-hover:text-white"
          >
            <ChevronRight className="size-[12px]" strokeWidth={3} />
          </span>
        </span>
      </Link>

      <p className="mb-[6px] mt-[14px] px-[4px] font-ui text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-body">
        Sub-categories
      </p>
      <ul className="space-y-[5px]">
        {main.subcategories.map((sub) => {
          const current = isCurrent(sub);
          const thumb = (
            <span className="relative block h-[45px] w-[30px] shrink-0 overflow-hidden rounded-[5px] border border-cart-line bg-white">
              <TileImage src={sub.image} sizes="30px" />
            </span>
          );
          const single =
            sub.children.length === 0 ||
            (sub.children.length === 1 && sub.children[0]!.name === sub.name);

          if (single) {
            return (
              <li key={sub.slug}>
                <Link
                  href={sub.href}
                  aria-current={current ? 'page' : undefined}
                  className={`${ROW} border bg-white ${
                    current
                      ? 'border-brand font-semibold text-brand'
                      : 'border-cart-line text-heading hover:text-brand'
                  }`}
                >
                  {thumb}
                  <span className="min-w-0 flex-1 truncate">{sub.name}</span>
                </Link>
              </li>
            );
          }

          const branch = current || sub.children.some(isCurrent);
          return (
            <li key={sub.slug}>
              <details
                open={branch}
                className={`group/sub rounded-[8px] border bg-white ${
                  branch ? 'border-brand' : 'border-cart-line'
                }`}
              >
                <summary
                  className={`${ROW} cursor-pointer list-none [&::-webkit-details-marker]:hidden ${
                    branch ? 'font-semibold text-brand' : 'text-heading hover:text-brand'
                  }`}
                >
                  {thumb}
                  <span className="min-w-0 flex-1 truncate">{sub.name}</span>
                  <span className="shrink-0 font-sans text-[11px] font-normal text-ink-body">
                    {sub.children.length}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-[13px] shrink-0 transition-transform group-open/sub:rotate-180"
                    strokeWidth={2.5}
                  />
                </summary>
                <div className="border-t border-cart-line px-[5px] pb-[6px] pt-[4px]">
                  <Link
                    href={sub.href}
                    aria-current={current ? 'page' : undefined}
                    className={`${ROW} font-ui font-semibold ${
                      current ? 'bg-brand-popup-bg text-brand' : 'text-brand hover:underline'
                    }`}
                  >
                    View all {sub.name}
                    <ArrowRight aria-hidden="true" className="size-[12px]" strokeWidth={2.5} />
                  </Link>
                  <ul>
                    {sub.children.map((child) => {
                      const here = isCurrent(child);
                      return (
                        <li key={child.slug}>
                          <Link
                            href={child.href}
                            aria-current={here ? 'page' : undefined}
                            className={`${ROW} ${
                              here
                                ? 'bg-brand-popup-bg font-semibold text-brand'
                                : 'text-ink-body hover:bg-brand-popup-bg hover:text-brand'
                            }`}
                          >
                            <span className="relative block h-[36px] w-[24px] shrink-0 overflow-hidden rounded-[4px] border border-cart-line">
                              <TileImage src={child.image} sizes="24px" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{child.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/** DESKTOP ONLY: Home > main > sub > sub-to-sub, the last crumb being the current page. */
export function CategoryBreadcrumb({
  trail,
}: {
  trail: readonly { name: string; href: string }[];
}) {
  const crumbs = [{ name: 'Home', href: '/' }, ...trail];
  return (
    <nav aria-label="Breadcrumb" className="hidden lg:block">
      <ol className="flex flex-wrap items-center gap-[6px] font-ui text-[13px] leading-[1.4] text-ink-body">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-[6px]">
              {last ? (
                <span aria-current="page" className="font-semibold text-brand">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link href={crumb.href} className="hover:text-brand hover:underline">
                    {crumb.name}
                  </Link>
                  <ChevronRight aria-hidden="true" className="size-[12px]" strokeWidth={2.5} />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
