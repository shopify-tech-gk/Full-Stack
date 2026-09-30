'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  ADDRESS_TYPES,
  ApiError,
  INDIAN_STATES,
  validateAddressForm,
  type AddressFormErrors,
  type AddressFormValues,
  type AddressInput,
} from '@youmart/shared-client';
import { Notice } from './Notice';
import {
  FIELD_ERROR,
  FORM_BUTTON,
  FORM_INPUT,
  FORM_LABEL,
  FORM_REQUIRED,
  FORM_ROW,
  TEXT_LINK,
} from './formStyles';

interface AddressFormProps {
  initial: AddressFormValues;
  title: string;
  /** Saves through address-service; a rejection is shown above the form. */
  onSave: (input: AddressInput) => Promise<void>;
  onCancel: () => void;
}

type TextKey = 'fullName' | 'phone' | 'line1' | 'line2' | 'landmark' | 'city' | 'pincode';

// Fields map 1:1 onto the address-service body (POST/PATCH /api/addresses); labels follow
// WooCommerce's India address form wording.
export function AddressForm({ initial, title, onSave, onCancel }: AddressFormProps) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = <K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const result = validateAddressForm(values);
    setErrors(result.errors);
    setFailure(null);
    if (!result.input) return;
    setSaving(true);
    try {
      await onSave(result.input);
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.status === 400
          ? error.message
          : 'We could not save this address. Please try again.',
      );
      setSaving(false);
    }
  };

  const describedBy = (key: keyof AddressFormValues) =>
    errors[key] ? `${id}-${key}-error` : undefined;
  const error = (key: keyof AddressFormValues) =>
    errors[key] && (
      <span id={`${id}-${key}-error`} className={FIELD_ERROR}>
        {errors[key]}
      </span>
    );

  const text = (
    key: TextKey,
    label: string,
    options: {
      required?: boolean;
      placeholder?: string;
      autoComplete?: string;
      inputMode?: 'numeric' | 'tel';
      type?: string;
      className?: string;
    } = {},
  ) => (
    <p className={`${FORM_ROW} ${options.className ?? ''}`}>
      <label htmlFor={`${id}-${key}`} className={FORM_LABEL}>
        {label}{' '}
        {options.required ? (
          <span className={FORM_REQUIRED}>*</span>
        ) : (
          <span className="font-normal">(optional)</span>
        )}
      </label>
      <input
        id={`${id}-${key}`}
        type={options.type ?? 'text'}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
        placeholder={options.placeholder}
        autoComplete={options.autoComplete}
        inputMode={options.inputMode}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={describedBy(key)}
        className={FORM_INPUT}
      />
      {error(key)}
    </p>
  );

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate aria-labelledby={`${id}-title`}>
      <h2
        id={`${id}-title`}
        className="mb-[16px] font-ui text-[20px] font-semibold leading-[26px] text-heading"
      >
        {title}
      </h2>
      {failure && <Notice tone="error">{failure}</Notice>}
      {errorCount > 0 && (
        <Notice tone="error">
          Please correct{' '}
          {errorCount === 1 ? 'the highlighted field' : `the ${errorCount} highlighted fields`}.
        </Notice>
      )}

      <div className="grid gap-x-[20px] md:grid-cols-2">
        {text('fullName', 'Full name', {
          required: true,
          autoComplete: 'name',
          className: 'md:col-span-2',
        })}
        {text('phone', 'Phone', {
          required: true,
          type: 'tel',
          inputMode: 'tel',
          autoComplete: 'tel-national',
          placeholder: '10-digit mobile number',
        })}
        <fieldset className={FORM_ROW}>
          <legend className={FORM_LABEL}>Address type</legend>
          <div className="flex h-[41.7px] items-center gap-[20px] lg:h-[45.8px]">
            {ADDRESS_TYPES.map((type) => (
              <label
                key={type.value}
                className="flex items-center gap-[6px] font-ui text-[15px] text-ink-body"
              >
                <input
                  type="radio"
                  name={`${id}-type`}
                  value={type.value}
                  checked={values.addressType === type.value}
                  onChange={() => set('addressType', type.value)}
                  className="size-[16px] accent-brand"
                />
                {type.label}
              </label>
            ))}
          </div>
        </fieldset>
        {text('line1', 'Street address', {
          required: true,
          autoComplete: 'address-line1',
          placeholder: 'House number and street name',
          className: 'md:col-span-2',
        })}
        {text('line2', 'Apartment, suite, unit, etc.', {
          autoComplete: 'address-line2',
          placeholder: 'Apartment, suite, unit, etc.',
          className: 'md:col-span-2',
        })}
        {text('landmark', 'Landmark', {
          placeholder: 'Nearby landmark',
          className: 'md:col-span-2',
        })}
        {text('city', 'Town / City', { required: true, autoComplete: 'address-level2' })}
        <p className={FORM_ROW}>
          <label htmlFor={`${id}-state`} className={FORM_LABEL}>
            State <span className={FORM_REQUIRED}>*</span>
          </label>
          <select
            id={`${id}-state`}
            value={values.state}
            onChange={(event) => set('state', event.target.value)}
            autoComplete="address-level1"
            aria-invalid={Boolean(errors.state)}
            aria-describedby={describedBy('state')}
            className={FORM_INPUT}
          >
            <option value="">Select an option&hellip;</option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          {error('state')}
        </p>
        {text('pincode', 'PIN Code', {
          required: true,
          inputMode: 'numeric',
          autoComplete: 'postal-code',
        })}
        <p className={FORM_ROW}>
          <label htmlFor={`${id}-country`} className={FORM_LABEL}>
            Country / Region <span className={FORM_REQUIRED}>*</span>
          </label>
          {/* India-only at launch (address-service default). */}
          <select
            id={`${id}-country`}
            value={values.country}
            onChange={(event) => set('country', event.target.value)}
            autoComplete="country-name"
            className={FORM_INPUT}
          >
            <option value="India">India</option>
          </select>
        </p>
      </div>

      <p className={FORM_ROW}>
        <label className="flex items-center gap-[8px] font-ui text-[15px] font-bold text-ink-body">
          <input
            type="checkbox"
            checked={values.isDefault}
            onChange={(event) => set('isDefault', event.target.checked)}
            className="size-[16px] accent-brand"
          />
          Set as my default address
        </label>
      </p>

      <p className="mx-[3px] flex flex-wrap items-center gap-[20px]">
        <button type="submit" disabled={saving} className={FORM_BUTTON}>
          {saving ? 'Saving…' : 'Save address'}
        </button>
        <button type="button" onClick={onCancel} className={`font-ui text-[16px] ${TEXT_LINK}`}>
          Cancel
        </button>
      </p>
    </form>
  );
}
