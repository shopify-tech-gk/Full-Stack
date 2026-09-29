'use client';

import { useState } from 'react';
import {
  ADDRESS_TYPES,
  EMPTY_ADDRESS_FORM,
  addressLines,
  addressToForm,
  type Address,
  type AddressInput,
} from '@youmart/shared-client';
import { AddressForm } from './AddressForm';
import { Notice } from './Notice';
import { BODY_TEXT, FORM_BUTTON, TEXT_LINK } from './formStyles';

type View = { mode: 'list' } | { mode: 'form'; id: string | null };

// DEMO: edits stay in component state. Wiring later = api.addresses.create/update/delete/
// setDefault, then refresh the list from the response.
export function AddressBook({ initial }: { initial: readonly Address[] }) {
  const [addresses, setAddresses] = useState<Address[]>([...initial]);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [message, setMessage] = useState<string | null>(null);

  const withDefault = (list: Address[], defaultId: string | null) =>
    defaultId ? list.map((a) => ({ ...a, isDefault: a.id === defaultId })) : list;

  const save = (input: AddressInput) => {
    const now = new Date().toISOString();
    const id = view.mode === 'form' && view.id ? view.id : `local-${Date.now()}`;
    const saved: Address = {
      id,
      fullName: input.fullName,
      phone: input.phone,
      line1: input.line1,
      line2: input.line2 ?? null,
      landmark: input.landmark ?? null,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      country: input.country ?? 'India',
      addressType: input.addressType ?? 'HOME',
      isDefault: Boolean(input.isDefault) || addresses.length === 0,
      createdAt: addresses.find((a) => a.id === id)?.createdAt ?? now,
      updatedAt: now,
    };
    const next = addresses.some((a) => a.id === id)
      ? addresses.map((a) => (a.id === id ? saved : a))
      : [...addresses, saved];
    setAddresses(withDefault(next, saved.isDefault ? id : null));
    setView({ mode: 'list' });
    setMessage('Address changed successfully.');
  };

  const remove = (address: Address) => {
    if (!window.confirm(`Delete the address for ${address.fullName}, ${address.city}?`)) return;
    setAddresses((list) => list.filter((a) => a.id !== address.id));
    setMessage('Address deleted.');
  };

  const makeDefault = (id: string) => {
    setAddresses((list) => withDefault(list, id));
    setMessage('Default address updated.');
  };

  if (view.mode === 'form') {
    const editing = addresses.find((a) => a.id === view.id);
    return (
      <AddressForm
        key={view.id ?? 'new'}
        title={editing ? 'Edit address' : 'Add a new address'}
        initial={
          editing
            ? addressToForm(editing)
            : { ...EMPTY_ADDRESS_FORM, isDefault: addresses.length === 0 }
        }
        onSave={save}
        onCancel={() => setView({ mode: 'list' })}
      />
    );
  }

  const action = `font-ui text-[15px] ${TEXT_LINK}`;

  return (
    <div>
      {message && <Notice tone="success">{message}</Notice>}
      <p className={`${BODY_TEXT} mb-[25.6px]`}>
        The following addresses will be used on the checkout page by default.
      </p>

      {addresses.length === 0 ? (
        <Notice tone="info">You have not set up any addresses yet.</Notice>
      ) : (
        <ul className="mb-[24px] grid gap-[20px] md:grid-cols-2">
          {addresses.map((address) => {
            const type =
              ADDRESS_TYPES.find((t) => t.value === address.addressType)?.label ??
              address.addressType;
            return (
              <li
                key={address.id}
                className="flex flex-col rounded-[10px] border border-catalog-rule bg-white"
              >
                <header className="flex flex-wrap items-center gap-[8px] border-b border-catalog-rule px-[1em] py-[0.7em]">
                  <h3 className="font-ui text-[19.2px] font-semibold leading-[1.3] text-heading">
                    {type}
                  </h3>
                  {address.isDefault && (
                    <span className="rounded-full bg-brand px-[10px] py-[2px] font-ui text-[12px] font-semibold uppercase tracking-[0.04em] text-white">
                      Default
                    </span>
                  )}
                </header>
                <address className={`${BODY_TEXT} flex-1 px-[1em] py-[0.8em] not-italic`}>
                  {addressLines(address).map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
                <div className="flex flex-wrap gap-x-[18px] gap-y-[6px] border-t border-catalog-rule px-[1em] py-[0.6em]">
                  <button
                    type="button"
                    onClick={() => setView({ mode: 'form', id: address.id })}
                    className={action}
                  >
                    Edit<span className="sr-only"> {type} address</span>
                  </button>
                  {!address.isDefault && (
                    <button
                      type="button"
                      onClick={() => makeDefault(address.id)}
                      className={action}
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(address)}
                    className={`font-ui text-[15px] text-woo-error hover:underline focus:outline-none focus-visible:underline`}
                  >
                    Delete<span className="sr-only"> {type} address</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setView({ mode: 'form', id: null });
        }}
        className={FORM_BUTTON}
      >
        Add new address
      </button>
    </div>
  );
}
