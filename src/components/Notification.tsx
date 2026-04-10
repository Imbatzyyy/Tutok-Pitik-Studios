import { X, AlertCircle, CheckCircle, Info, Lock, XCircle } from 'lucide-react';

interface NotificationProps {
  show: boolean;
  onClose: () => void;
  type?: 'success' | 'error' | 'info' | 'warning' | 'login';
  title: string;
  message: string;
  showButton?: boolean;
  buttonText?: string;
  onButtonClick?: () => void;
}

export default function Notification({
  show,
  onClose,
  type = 'info',
  title,
  message,
  showButton = false,
  buttonText = 'Okay',
  onButtonClick
}: NotificationProps) {
  if (!show) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={56} />;
      case 'error':
        return <XCircle size={56} />;
      case 'warning':
        return <AlertCircle size={56} />;
      case 'login':
        return <Lock size={56} />;
      default:
        return <Info size={56} />;
    }
  };

  const getIconClass = () => {
    switch (type) {
      case 'success':
        return 'notification-icon-success';
      case 'error':
        return 'notification-icon-error';
      case 'warning':
        return 'notification-icon-warning';
      case 'login':
        return 'notification-icon-login';
      default:
        return 'notification-icon-info';
    }
  };

  return (
    <div className="notification-overlay" onClick={onClose}>
      <div className="notification-popup" onClick={(e) => e.stopPropagation()}>
        <button className="notification-close" onClick={onClose}>
          <X size={20} />
        </button>
        
        <div className={`notification-icon ${getIconClass()}`}>
          {getIcon()}
        </div>
        
        <h3 className="notification-title">{title}</h3>
        <p className="notification-message">{message}</p>
        
        <div className="notification-actions">
          {showButton && onButtonClick && (
            <button className="notification-btn-secondary" onClick={onButtonClick}>
              {buttonText}
            </button>
          )}
          <button className="notification-btn-primary" onClick={onClose}>
            {showButton ? 'Close' : 'Okay'}
          </button>
        </div>
      </div>
    </div>
  );
}