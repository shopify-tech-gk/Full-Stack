import type { ApiErrorCode } from '@youmart/shared-types';

/**
 * Typed application error every route/feature throws instead of a bare
 * Error - the central error handler maps it straight to the ApiError
 * envelope using `code` and `httpStatus`.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, httpStatus: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}
