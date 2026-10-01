import Link from 'next/link';
import { listingPageHref, paginationItems } from '@youmart/shared-client';

interface PaginationProps {
  current: number;
  totalPages: number;
  basePath: string;
  /** Preserved filter query string (leading `?` or empty). */
  query: string;
}

const CELL = 'flex size-[40px] items-center justify-center text-[16px] leading-none';

export function Pagination({ current, totalPages, basePath, query }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }
  const href = (page: number) => listingPageHref(basePath, query, page);
  const link = `${CELL} font-ui text-brand hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`;

  return (
    <nav aria-label="Product Pagination">
      <ul className="m-px flex flex-wrap gap-[7.7px]">
        {current > 1 && (
          <li>
            <Link href={href(current - 1)} className={link} aria-label="Previous page">
              &larr;
            </Link>
          </li>
        )}
        {paginationItems(current, totalPages).map((item, index) => (
          <li key={item === 'dots' ? `dots-${index}` : item}>
            {item === 'dots' ? (
              <span className={`${CELL} font-sans text-ink-body`}>&hellip;</span>
            ) : item === current ? (
              <span aria-current="page" className={`${CELL} bg-brand font-sans text-white`}>
                <span className="sr-only">Page </span>
                {item}
              </span>
            ) : (
              <Link href={href(item)} className={link}>
                <span className="sr-only">Page </span>
                {item}
              </Link>
            )}
          </li>
        ))}
        {current < totalPages && (
          <li>
            <Link href={href(current + 1)} className={link} aria-label="Next page">
              &rarr;
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
