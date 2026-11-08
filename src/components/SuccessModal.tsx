import { CalendarPlus, CircleCheck, Copy } from 'lucide-react';
import { toast } from 'sonner';
import Modal from './common/Modal';
import type { BookingSuccess } from './Contact';
import { STUDIO } from '../content/site';
import { formatPesoExact } from '../lib/format';

interface SuccessModalProps {
  booking: BookingSuccess | null;
  onClose: () => void;
  onViewBookings: () => void;
}

const calendarLink = (booking: BookingSuccess) => {
  const stamp = (time: string) => `${booking.date.replace(/-/g, '')}T${time.replace(':', '')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${booking.service} · ${STUDIO.name}`,
    dates: `${stamp(booking.startTime)}/${stamp(booking.endTime)}`,
    details: `Booking ${booking.reference} (pending confirmation). Questions: ${STUDIO.phoneDisplay}`,
    location: booking.location,
    ctz: 'Asia/Manila',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export default function SuccessModal({ booking, onClose, onViewBookings }: SuccessModalProps) {
  if (!booking) return null;

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(booking.reference);
      toast.success('Reference copied');
    } catch {
      toast(booking.reference);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      className="success-modal"
      icon={<CircleCheck size={26} />}
      title="Booking request received"
      description={`We sent a copy to ${booking.email}. We will check your GCash downpayment and confirm your date by email.`}
      footer={
        <>
          <a className="btn btn-ghost" href={calendarLink(booking)} target="_blank" rel="noopener noreferrer">
            <CalendarPlus size={18} /> Add to calendar
          </a>
          <button type="button" className="btn btn-primary" onClick={onViewBookings} data-autofocus>
            Track my booking
          </button>
        </>
      }
    >
      <div className="success-ref">
        <span>Reference</span>
        <strong>{booking.reference}</strong>
        <button type="button" className="icon-btn icon-btn-sm" onClick={copyReference} aria-label="Copy reference">
          <Copy size={16} />
        </button>
      </div>
      <dl className="confirm-list">
        <div><dt>Service</dt><dd>{booking.service}</dd></div>
        <div><dt>Date</dt><dd>{booking.dateDisplay}</dd></div>
        <div><dt>Time</dt><dd>{booking.time}</dd></div>
        <div><dt>Location</dt><dd>{booking.location}</dd></div>
        <div><dt>Downpayment submitted</dt><dd>{formatPesoExact(booking.downpayment)}</dd></div>
        <div><dt>Balance on shoot day</dt><dd>{formatPesoExact(booking.balance)} + transportation (if any)</dd></div>
      </dl>
      <ol className="next-steps">
        <li><strong>We review your payment</strong> and confirm by email.</li>
        <li><strong>Status updates</strong> appear in Profile → Bookings.</li>
        <li><strong>After the shoot</strong>, your Google Drive photo link shows up there too.</li>
      </ol>
    </Modal>
  );
}
