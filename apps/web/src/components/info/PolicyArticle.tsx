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

// Live WordPress policy pages: a single text column (966.6px at 1366) of Outfit 16/25.6 copy with
// bold titles. Live drops paragraph spacing below 1025px; we keep it.
export function PolicyArticle({ page }: { page: PolicyPage }) {
  return (
    <div className="mx-auto mt-[68px] max-w-[1240px] px-[8px] lg:mb-[64px] lg:mt-[64px] lg:px-[20px]">
      <article className="px-[24.6px] pb-[31.9px] pt-[31.9px] md:px-[53.2px] md:pt-[88.4px] lg:px-[116.7px] lg:pb-[85.4px] lg:pt-[95.4px]">
        <h1 className={`${TEXT} ${GAP} font-bold`}>{page.title}</h1>
        {page.sections.map((section, index) => (
          <section key={section.heading ?? index}>
            {section.heading && <h2 className={`${TEXT} font-bold`}>{section.heading}</h2>}
            {section.blocks.map((block, blockIndex) => (
              <Block key={blockIndex} block={block} />
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
