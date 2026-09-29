'use client';

import { useEffect, type RefObject } from 'react';

/** Esc-to-close, body scroll lock, initial focus and focus restore for overlays. */
export function useModal(open: boolean, onClose: () => void, focusRef: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    focusRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open, onClose, focusRef]);
}
