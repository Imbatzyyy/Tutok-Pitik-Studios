import { useEffect, useState, type RefObject } from 'react';

/**
 * True while the target overlaps the viewport (shrunk by `rootMargin`).
 * Pass an element id for sections rendered elsewhere, or a ref for own elements.
 */
export function useInView(target: string | RefObject<Element | null>, rootMargin = '0px') {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = typeof target === 'string' ? document.getElementById(target) : target.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, rootMargin]);

  return inView;
}

/** Bottom third of the viewport: where the floating buttons and booking bar sit. */
export const BOTTOM_BAND = '-66% 0px 0px 0px';
