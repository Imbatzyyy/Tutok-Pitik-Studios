import { useEffect, useRef } from 'react';

// Shared behavior for every overlay: scroll lock (ref-counted so stacked modals
// don't fight), Escape closes only the top-most modal, focus moves into the
// dialog, Tab stays inside it, and focus returns to the trigger on close.

let lockCount = 0;
let savedOverflow = '';
const modalStack: symbol[] = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const lockScroll = () => {
  if (lockCount === 0) {
    savedOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }
  lockCount += 1;
};

export const unlockScroll = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.style.overflow = savedOverflow;
  }
};

export function useModal<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose?: () => void, options: { lock?: boolean; autoFocus?: boolean } = {}) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { lock = true, autoFocus = true } = options;

  useEffect(() => {
    if (!open) return;

    const id = Symbol('modal');
    modalStack.push(id);
    if (lock) lockScroll();
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      if (!autoFocus || !ref.current) return;
      if (ref.current.contains(document.activeElement)) return;
      const preferred = ref.current.querySelector<HTMLElement>('[data-autofocus]');
      const first = preferred || ref.current.querySelector<HTMLElement>(FOCUSABLE);
      (first || ref.current).focus({ preventScroll: true });
    }, 30);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== id) return;
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && ref.current) {
        const focusables = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (element) => element.offsetParent !== null || element === document.activeElement
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const index = modalStack.indexOf(id);
      if (index >= 0) modalStack.splice(index, 1);
      if (lock) unlockScroll();
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, lock, autoFocus]);

  return ref;
}
