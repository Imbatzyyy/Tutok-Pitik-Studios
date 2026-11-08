import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useModal } from '../../hooks/useModal';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Prevent closing on backdrop click (e.g. while saving). */
  dismissible?: boolean;
  labelledBy?: string;
}

export default function Modal({ open, onClose, title, description, icon, children, footer, size = 'md', className = '', dismissible = true }: ModalProps) {
  const ref = useModal<HTMLDivElement>(open, dismissible ? onClose : undefined);
  const titleId = useId();
  if (!open) return null;

  return (
    <div className="ui-modal-backdrop" onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className={`ui-modal ui-modal-${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {(title || icon) && (
          <header className="ui-modal-header">
            {icon && <div className="ui-modal-icon">{icon}</div>}
            <div className="ui-modal-heading">
              {title && <h2 id={titleId}>{title}</h2>}
              {description && <p>{description}</p>}
            </div>
          </header>
        )}
        {dismissible && (
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        )}
        <div className="ui-modal-body">{children}</div>
        {footer && <footer className="ui-modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}
