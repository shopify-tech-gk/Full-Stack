import type { ApiError, ApiErrorCode } from '@youmart/shared-types';

/** Builds the standard `{ error: { code, message, details? } }` envelope. */
export function buildApiError(code: ApiErrorCode, message: string, details?: unknown): ApiError {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
