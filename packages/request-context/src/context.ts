import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextStore {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/**
 * Runs `fn` with `requestId` available to any code executed inside it
 * (including anything reached via later awaits/promises) via
 * `getRequestId()` - this is how a single incoming request's id reaches
 * @youmart/service-client's outbound calls without threading it through
 * every route handler/service function signature by hand.
 */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

/** Returns the current request's id, or `undefined` if called outside any
 * `runWithRequestId` context (e.g. a startup script, a queue worker job
 * not itself triggered by an inbound HTTP request). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
