import {
  createAddressClient,
  createOrderClient,
  createPaymentClient,
  mintCallerServiceToken,
  request,
  type ServiceAuthOptions,
} from '@youmart/service-client';
import { config } from './config';

// W9 (account deletion) - self-minted short-lived service token per call, never a user token.
const serviceAuth: ServiceAuthOptions = {
  callerServiceName: 'auth-service',
  serviceSecret: config.serviceJwtSecret,
  ttlSeconds: config.serviceTokenTtlSeconds,
};

export const orderClient = createOrderClient({
  baseUrl: config.orderServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

export const paymentClient = createPaymentClient({
  baseUrl: config.paymentServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

export const addressClient = createAddressClient({
  baseUrl: config.addressServiceUrl,
  timeoutMs: config.serviceHttpTimeoutMs,
  serviceAuth,
});

/** catalog-service: erase the user's recently viewed history (`DELETE /catalog/internal/...`). */
export async function eraseRecentlyViewed(userId: string): Promise<void> {
  await request<unknown>({
    baseUrl: config.catalogServiceUrl,
    path: `/catalog/internal/users/${userId}/recently-viewed`,
    method: 'DELETE',
    authToken: mintCallerServiceToken(serviceAuth),
    timeoutMs: config.serviceHttpTimeoutMs,
  });
}
