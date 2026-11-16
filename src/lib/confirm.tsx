import { useEffect, useState, type ReactNode } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
type Listener = (pending: Pending | null) => void;

let listener: Listener | null = null;

/**
 * Ask a yes/no question in the styled dialog. Pages without a mounted <ConfirmHost/>
 * (the customer site) fall back to the browser's own confirm box.
 */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  if (!listener) {
    const text = [options.title, typeof options.message === 'string' ? options.message : ''].filter(Boolean).join('\n\n');
    return Promise.resolve(window.confirm(text));
  }
  const show = listener;
  return new Promise((resolve) => show({ ...options, resolve }));
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    const own: Listener = (next) => setPending(next);
    listener = own;
    return () => {
      if (listener === own) listener = null;
    };
  }, []);

  const finish = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmDialog
      open={Boolean(pending)}
      title={pending?.title || ''}
      message={pending?.message}
      confirmLabel={pending?.confirmLabel || 'Confirm'}
      cancelLabel={pending?.cancelLabel || 'Cancel'}
      tone={pending?.tone || 'primary'}
      autoFocus="cancel"
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  );
}
