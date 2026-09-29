'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { formatMoney, productHref, type CartLine } from '@youmart/shared-client';
import { QuantityStepper } from './QuantityStepper';

interface CartLinesProps {
  items: readonly CartLine[];
  imageFor: (line: CartLine) => string;
  onQuantity: (line: CartLine, quantity: number) => void;
  onRemove: (line: CartLine) => void;
}

const TH =
  'whitespace-nowrap border-b-2 border-cart-border px-[8px] py-[12px] text-left text-[11.5px] font-bold uppercase leading-[25.6px] tracking-[0.02em] text-cart-ink';
const TD = 'border-b border-cart-line px-[8px] py-[12px] align-middle leading-[25.6px]';
const NAME =
  'line-clamp-2 font-ui text-[13px] font-semibold leading-[1.35] text-cart-ink hover:text-brand focus:outline-none focus-visible:underline';

function Thumb({ line, src }: { line: CartLine; src: string }) {
  return (
    <Link href={productHref(line.productSlug)} tabIndex={-1} aria-hidden="true">
      <Image
        src={src}
        alt=""
        width={52}
        height={52}
        unoptimized={src.endsWith('.svg')}
        className="mx-auto block size-[52px] rounded-[6px] border border-cart-line bg-white object-cover"
      />
    </Link>
  );
}

function RemoveButton({ line, onRemove }: { line: CartLine; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${line.title} from cart`}
      className="group inline-flex size-[34px] min-w-[34px] items-center justify-center rounded-[8px] bg-cart-rowBg transition-colors hover:bg-cart-danger focus:outline-none focus-visible:bg-cart-danger"
    >
      <Trash2
        aria-hidden="true"
        strokeWidth={2}
        className="size-[15px] text-brand transition-colors group-hover:text-white group-focus-visible:text-white"
      />
    </button>
  );
}

// Live #ymc-cart-table: white card, 2px #90caf9 border, radius 10, light-blue rows. Below 681px
// live keeps the 6-column table at 9-10px text; we switch to readable stacked rows instead.
export function CartLines({ items, imageFor, onQuantity, onRemove }: CartLinesProps) {
  return (
    <>
      <table className="mb-[24px] mt-[40px] hidden w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-[10px] border-2 border-cart-border bg-white font-system shadow-cart-table min-[681px]:table">
        <caption className="sr-only">Shopping cart</caption>
        <colgroup>
          <col className="w-[68px]" />
          <col />
          <col className="w-[90px]" />
          <col className="w-[110px]" />
          <col className="w-[90px]" />
          <col className="w-[50px]" />
        </colgroup>
        <thead className="bg-cart-headBg">
          <tr>
            <th scope="col" colSpan={2} className={TH}>
              Product
            </th>
            <th scope="col" className={TH}>
              Price
            </th>
            <th scope="col" className={`${TH} text-center`}>
              Qty
            </th>
            <th scope="col" className={TH}>
              Subtotal
            </th>
            <th scope="col" className={TH}>
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((line) => (
            <tr
              key={line.cartItemId}
              className="bg-cart-rowBg transition-colors hover:bg-cart-rowHover [&:last-child>td]:border-b-0"
            >
              <td className={`${TD} text-center`}>
                <Thumb line={line} src={imageFor(line)} />
              </td>
              <th scope="row" className={`${TD} text-left font-normal`}>
                <Link href={productHref(line.productSlug)} className={NAME}>
                  {line.title}
                </Link>
              </th>
              <td className={`${TD} text-[13.5px] font-bold text-cart-ink`}>
                {formatMoney(line.priceSnapshot)}
              </td>
              <td className={`${TD} text-center`}>
                <QuantityStepper
                  title={line.title}
                  quantity={line.quantity}
                  onChange={(quantity) => onQuantity(line, quantity)}
                />
              </td>
              <td className={`${TD} text-[13.5px] font-bold text-brand`}>
                {formatMoney(line.lineTotal)}
              </td>
              <td className={`${TD} text-center`}>
                <RemoveButton line={line} onRemove={() => onRemove(line)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul
        aria-label="Shopping cart"
        className="mb-[24px] mt-[40px] overflow-hidden rounded-[10px] border-2 border-cart-border bg-white font-system shadow-cart-table min-[681px]:hidden"
      >
        {items.map((line) => (
          <li
            key={line.cartItemId}
            className="grid grid-cols-[52px_1fr_34px] gap-x-[10px] gap-y-[8px] border-b border-cart-line bg-cart-rowBg p-[10px] last:border-b-0"
          >
            <Thumb line={line} src={imageFor(line)} />
            <div className="min-w-0">
              <Link href={productHref(line.productSlug)} className={NAME}>
                {line.title}
              </Link>
              <p className="mt-[2px] text-[13px] font-bold text-cart-ink">
                {formatMoney(line.priceSnapshot)}
              </p>
            </div>
            <RemoveButton line={line} onRemove={() => onRemove(line)} />
            <div className="col-span-2 col-start-2 flex items-center justify-between gap-[10px]">
              <QuantityStepper
                title={line.title}
                quantity={line.quantity}
                onChange={(quantity) => onQuantity(line, quantity)}
              />
              <p className="text-[13.5px] font-bold text-brand">
                <span className="sr-only">Subtotal </span>
                {formatMoney(line.lineTotal)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
