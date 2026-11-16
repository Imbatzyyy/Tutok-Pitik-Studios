import { useState, type ReactNode } from 'react';
import { AlertTriangle, CircleCheck, LoaderCircle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  autoFocus?: 'confirm' | 'cancel';
  tone?: 'danger' | 'primary';
  icon?: ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: ReactNode;
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', confirmDisabled = false, autoFocus = 'confirm', tone = 'primary', icon, onConfirm, onCancel, children }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy || confirmDisabled) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      dismissible={!busy}
      size="sm"
      title={title}
      description={message}
      icon={icon ?? (tone === 'danger' ? <AlertTriangle size={22} /> : <CircleCheck size={22} />)}
      className={`ui-confirm ui-confirm-${tone}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy} data-autofocus={autoFocus === 'cancel' ? true : undefined}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={handleConfirm} disabled={busy || confirmDisabled} data-autofocus={!confirmDisabled && autoFocus === 'confirm' ? true : undefined}>
            {busy && <LoaderCircle size={16} className="spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
