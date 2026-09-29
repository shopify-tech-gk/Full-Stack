import { Fragment } from 'react';
import Link from 'next/link';
import { parseInline } from '@youmart/shared-client';
import { TEXT_LINK } from '@/components/account/formStyles';

/** Renders site-pages copy: **bold**, [label](href) and line breaks. */
export function RichText({
  text,
  linkClassName = TEXT_LINK,
}: {
  text: string;
  linkClassName?: string;
}) {
  return (
    <>
      {text.split('\n').map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {parseInline(line).map((token, index) => {
            if (token.type === 'strong') return <strong key={index}>{token.text}</strong>;
            if (token.type === 'text') return <Fragment key={index}>{token.text}</Fragment>;
            return token.href.startsWith('/') ? (
              <Link key={index} href={token.href} className={linkClassName}>
                {token.text}
              </Link>
            ) : (
              <a key={index} href={token.href} className={linkClassName}>
                {token.text}
              </a>
            );
          })}
        </Fragment>
      ))}
    </>
  );
}
