import { FIELD_ERROR, FORM_LABEL, FORM_REQUIRED, FORM_ROW } from '@/components/account/formStyles';

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  /** Receives the aria props the control must spread. */
  children: (aria: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
}

/** WooCommerce form row: bold Outfit label, red * or "(optional)", error under the control. */
export function Field({
  id,
  label,
  required = false,
  error,
  className = '',
  children,
}: FieldProps) {
  return (
    <p className={`${FORM_ROW} ${className}`}>
      <label htmlFor={id} className={FORM_LABEL}>
        {label}{' '}
        {required ? (
          <span className={FORM_REQUIRED}>*</span>
        ) : (
          <span className="font-normal">(optional)</span>
        )}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': error ? `${id}-error` : undefined,
      })}
      {error && (
        <span id={`${id}-error`} className={FIELD_ERROR}>
          {error}
        </span>
      )}
    </p>
  );
}
