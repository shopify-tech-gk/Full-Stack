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
import { api } from '@/lib/api';
import { useAddresses } from '@/lib/addresses';
import { AddressForm } from './AddressForm';
import { Notice } from './Notice';
import { BODY_TEXT, FORM_BUTTON, TEXT_LINK } from './formStyles';

type View = { mode: 'list' } | { mode: 'form'; id: string | null };

// address-service owns the rules: one default per customer (setting one un-defaults the rest;
// deleting the default promotes the newest), and every call is scoped to the signed-in user.
// After each change the list is re-read so order and default flags are the server's.
export function AddressBook() {
  const { addresses, failed, reload } = useAddresses();
  const [view, setView] = useState<View>({ mode: 'list' });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (failed) {
    return (
      <Notice tone="error">
        We could not load your addresses.{' '}
        <button type="button" onClick={() => void reload()} className={TEXT_LINK}>
          Try again
        </button>
      </Notice>
    );
  }
  if (!addresses) {
    return <div aria-busy="true" className="min-h-[240px]" />;
  }

  const save = async (input: AddressInput) => {
    const editing =
      view.mode === 'form' && view.id ? addresses.find((a) => a.id === view.id) : null;
    if (editing) {
      // The default stays the default until another address is made default (never zero).
      await api.addresses.update(editing.id, {
        ...input,
        isDefault: editing.isDefault || Boolean(input.isDefault),
      });
    } else {
      await api.addresses.create({
        ...input,
        isDefault: addresses.length === 0 || Boolean(input.isDefault),
      });
    }
    await reload();
    setView({ mode: 'list' });
    setMessage({ tone: 'success', text: 'Address changed successfully.' });
  };

  const act = async (address: Address, call: () => Promise<unknown>, done: string) => {
    setBusyId(address.id);
    setMessage(null);
    try {
      await call();
      await reload();
      setMessage({ tone: 'success', text: done });
    } catch {
      setMessage({ tone: 'error', text: 'That did not work. Please try again.' });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const remove = (address: Address) => {
    if (!window.confirm(`Delete the address for ${address.fullName}, ${address.city}?`)) return;
    void act(address, () => api.addresses.remove(address.id), 'Address deleted.');
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

  const action = `font-ui text-[15px] disabled:cursor-wait disabled:opacity-60 ${TEXT_LINK}`;

  return (
    <div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
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
            const busy = busyId === address.id;
            return (
              <li
                key={address.id}
                aria-busy={busy || undefined}
                // POLISH (flagged): resting shadow + hover lift, brand-blue border on the default.
                className={`flex flex-col rounded-[10px] border bg-white shadow-rail-card transition-shadow duration-200 hover:shadow-product-card ${
                  address.isDefault ? 'border-cart-border' : 'border-catalog-rule'
                } ${busy ? 'opacity-70' : ''}`}
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
                    disabled={busy}
                    onClick={() => {
                      setMessage(null);
                      setView({ mode: 'form', id: address.id });
                    }}
                    className={action}
                  >
                    Edit<span className="sr-only"> {type} address</span>
                  </button>
                  {!address.isDefault && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          address,
                          () => api.addresses.setDefault(address.id),
                          'Default address updated.',
                        )
                      }
                      className={action}
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(address)}
                    className="font-ui text-[15px] text-woo-error hover:underline focus:outline-none focus-visible:underline disabled:cursor-wait disabled:opacity-60"
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
