'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  ADDRESS_TYPES,
  EMPTY_ADDRESS_FORM,
  addressLines,
  type Address,
  type AddressInput,
} from '@youmart/shared-client';
import { AddressForm } from '@/components/account/AddressForm';
import { TEXT_LINK } from '@/components/account/formStyles';
import { api } from '@/lib/api';

interface AddressPickerProps {
  addresses: readonly Address[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Called with the saved address once address-service has stored it. */
  onAdded: (address: Address) => Promise<void>;
}

// Saved-address cards (address-service model) instead of live's one-off billing form; a new
// address is saved to the address book, and checkout only sends its id.
export function AddressPicker({ addresses, selectedId, onSelect, onAdded }: AddressPickerProps) {
  const [adding, setAdding] = useState(addresses.length === 0);

  const save = async (input: AddressInput) => {
    const address = await api.addresses.create({
      ...input,
      isDefault: addresses.length === 0 || Boolean(input.isDefault),
    });
    await onAdded(address);
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="rounded-[10px] border border-catalog-rule bg-white p-[15px] lg:p-[20px]">
        <AddressForm
          title="Add a new address"
          initial={{ ...EMPTY_ADDRESS_FORM, isDefault: addresses.length === 0 }}
          onSave={save}
          onCancel={() => setAdding(false)}
        />
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="sr-only">Choose a delivery address</legend>
      <ul className="grid gap-[12px]">
        {addresses.map((address) => {
          const selected = address.id === selectedId;
          const type =
            ADDRESS_TYPES.find((t) => t.value === address.addressType)?.label ??
            address.addressType;
          return (
            <li key={address.id}>
              <label
                className={`flex cursor-pointer gap-[12px] rounded-[10px] border bg-white p-[14px] transition-colors hover:bg-cart-rowHover ${
                  selected
                    ? 'border-brand bg-cart-rowHover ring-1 ring-brand'
                    : 'border-catalog-rule'
                }`}
              >
                <input
                  type="radio"
                  name="delivery-address"
                  value={address.id}
                  checked={selected}
                  onChange={() => onSelect(address.id)}
                  className="mt-[3px] size-[18px] shrink-0 accent-brand"
                />
                <span className="min-w-0 font-ui text-[14.6px] leading-[1.55] text-ink-body lg:text-[15px]">
                  <span className="mb-[2px] flex flex-wrap items-center gap-[8px]">
                    <strong className="text-heading">{address.fullName}</strong>
                    <span className="rounded-[4px] border border-catalog-rule px-[6px] text-[11px] font-semibold uppercase tracking-[0.04em] text-brand">
                      {type}
                    </span>
                    {address.isDefault && (
                      <span className="rounded-full bg-brand px-[8px] text-[11px] font-semibold uppercase tracking-[0.04em] text-white">
                        Default
                      </span>
                    )}
                  </span>
                  {addressLines(address)
                    .slice(1)
                    .map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className={`mt-[14px] inline-flex items-center gap-[6px] font-ui text-[15px] font-semibold ${TEXT_LINK}`}
      >
        <Plus aria-hidden="true" className="size-[16px]" strokeWidth={2.5} />
        Add a new address
      </button>
    </fieldset>
  );
}
