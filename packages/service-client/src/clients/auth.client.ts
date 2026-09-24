import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

/** Backed by `GET /auth/internal/users/:userId/contact` (Ch6.2). */
export interface UserContactView {
  userId: string;
  phone: string;
  email: string | null;
}

export interface CreateAuthClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  /** SERVICE-ONLY endpoint (Ch6.5) - a service token is minted fresh per
   * call, never a forwarded user token. */
  serviceAuth: ServiceAuthOptions;
}

export interface AuthClient {
  /** Resolves a user's own phone/email so another service can enqueue a
   * notification without ever querying the auth schema directly
   * (cross-schema isolation). Throws a `404` `AppError` if the user
   * doesn't exist. */
  getUserContact(userId: string): Promise<UserContactView>;
}

/** `baseUrl` (e.g. `AUTH_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createAuthClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
}: CreateAuthClientOptions): AuthClient {
  return {
    getUserContact(userId) {
      return request<UserContactView>({
        baseUrl,
        path: `/auth/internal/users/${userId}/contact`,
        method: 'GET',
        authToken: mintCallerServiceToken(serviceAuth),
        timeoutMs,
      });
    },
  };
}
