import { useEffect } from 'react';

interface SuccessModalProps {
  active: boolean;
  data: any;
  onClose: () => void;
}

export default function SuccessModal({ active, data, onClose }: SuccessModalProps) {
  useEffect(() => {
    document.body.style.overflow = active ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [active]);

  if (!active || !data) return null;

  return (
    <div className={`modal-overlay ${active ? 'active' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal-content">
        <div className="modal-success-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="3" />
            <path d="M20 32L28 40L44 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="modal-title">Booking Request Submitted!</h3>
        <p className="modal-subtitle">Thank you for choosing Tutok Pitik Studios</p>

        <div className="modal-booking-details">
          <div className="modal-detail-row">
            <span className="modal-label">Service</span>
            <span className="modal-value">{data.service}</span>
          </div>
          <div className="modal-detail-row">
            <span className="modal-label">Date</span>
            <span className="modal-value">{data.date}</span>
          </div>
          <div className="modal-detail-row">
            <span className="modal-label">Time</span>
            <span className="modal-value">{data.time}</span>
          </div>
          <div className="modal-detail-row">
            <span className="modal-label">Duration</span>
            <span className="modal-value">{data.duration}</span>
          </div>
          <div className="modal-divider"></div>
          <div className="modal-detail-row modal-total">
            <span className="modal-label">Total Amount</span>
            <span className="modal-value modal-price">{data.price}</span>
          </div>
        </div>

        <div className="modal-info-box">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
              stroke="currentColor" strokeWidth="2" />
            <path d="M10 14V10M10 6H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <p className="modal-info-title">What happens next?</p>
            <p className="modal-info-text">
              We'll send payment details to <strong>{data.email}</strong> within 24 hours. 
              Please check your email for booking confirmation and payment instructions.
            </p>
          </div>
        </div>

        <button className="modal-close-btn" onClick={onClose}>
          <span>Got it, thanks!</span>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5Z"
              stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 9L8 11L12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
