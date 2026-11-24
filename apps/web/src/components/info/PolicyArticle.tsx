import type { PolicyBlock, PolicyPage } from '@youmart/shared-client';
import { RichText } from './RichText';

const TEXT =
  'font-ui text-[14.6px] leading-[23.35px] text-ink-body lg:text-[16px] lg:leading-[25.6px]';
const GAP = 'mb-[21.9px] md:mb-[23.35px] lg:mb-[25.6px]';

function Block({ block }: { block: PolicyBlock }) {
  if (block.type === 'p') {
    return (
      <p className={`${TEXT} ${GAP}`}>
        <RichText text={block.text} />
      </p>
    );
  }
  const List = block.type === 'ul' ? 'ul' : 'ol';
  return (
    <List
      className={`mb-[21.9px] ml-[43.8px] font-sans text-[14.6px] leading-[23.35px] text-ink-body lg:mb-[24px] lg:ml-[48px] lg:text-[16px] lg:leading-[25.6px] ${
        block.type === 'ul' ? 'list-disc' : 'list-decimal'
      }`}
    >
      {block.items.map((item) => (
        <li key={item}>
          <RichText text={item} />
        </li>
      ))}
    </List>
  );
}

const slugOf = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// Policy pages (Privacy, Terms, Refund, Shipping, Offers): a brand-blue title band, then the text in
// a readable white card with clear section headings, and "On this page" links beside it on desktop.
export function PolicyArticle({ page, children }: { page: PolicyPage; children?: React.ReactNode }) {
  const title = page.title.replace(/\s*[–-]\s*you\s*mart\s*:?$/i, '').trim();
  const headings = page.sections.filter((s) => s.heading).map((s) => s.heading!);
  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#061a45_0%,#0142aa_55%,#1e88e5_100%)]">
        <span aria-hidden="true" className="absolute -right-[80px] -top-[120px] size-[340px] rounded-full bg-white/[0.07]" />
        <div className="relative mx-auto max-w-[1240px] px-[20px] py-[40px] lg:py-[56px]">
          <p className="font-ui text-[13px] font-semibold uppercase tracking-[0.12em] text-[#ffd60a]">YouMart policies</p>
          <h1 className="mt-[8px] font-ui text-[30px] font-bold leading-[1.2] text-white lg:text-[42px]">{title}</h1>
        </div>
      </section>
      <div className="mx-auto max-w-[1240px] px-[12px] py-[28px] lg:grid lg:grid-cols-[1fr_260px] lg:items-start lg:gap-[28px] lg:px-[20px] lg:pb-[64px] lg:pt-[36px]">
        <div className="min-w-0">
          {children}
          <article className="rounded-[18px] border border-catalog-rule bg-white px-[22px] py-[26px] shadow-rail-card md:px-[40px] lg:px-[56px] lg:py-[44px]">
            {page.sections.map((section, index) => (
              <section
                key={section.heading ?? index}
                id={section.heading ? slugOf(section.heading) : undefined}
                className="scroll-mt-[110px]"
              >
                {section.heading && (
                  <h2 className="mb-[10px] mt-[8px] font-ui text-[18px] font-semibold leading-[1.35] text-heading lg:text-[20px]">
                    {section.heading}
                  </h2>
                )}
                {section.blocks.map((block, blockIndex) => (
                  <Block key={blockIndex} block={block} />
                ))}
              </section>
            ))}
          </article>
        </div>
        {headings.length > 2 ? (
          <nav aria-label="On this page" className="hidden rounded-[16px] border border-catalog-rule bg-white p-[16px] shadow-rail-card lg:sticky lg:top-[96px] lg:block">
            <p className="mb-[8px] font-ui text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">On this page</p>
            <ul className="space-y-[2px]">
              {headings.map((h) => (
                <li key={h}>
                  <a href={`#${slugOf(h)}`} className="block rounded-[8px] px-[8px] py-[6px] font-ui text-[13.5px] text-ink-body hover:bg-[#eef3fc] hover:text-brand">
                    {h}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </>
  );
}
