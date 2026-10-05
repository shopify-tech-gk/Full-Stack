'use client';

import { useRecordProductView } from '@/lib/recently-viewed';
import { useSession } from '@/lib/session';

/** Records this product view (fire-and-forget, after hydration). Renders nothing. */
export function ProductViewTracker({ productId }: { productId: string }) {
  const session = useSession();
  useRecordProductView(productId, session.status);
  return null;
}
