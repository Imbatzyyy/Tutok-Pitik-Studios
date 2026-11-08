import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, ExternalLink, FileDown, LoaderCircle, Mail, MapPin, Phone, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import { callEdge, errorMessage } from '../../lib/api';
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  PHOTO_STATUSES,
  paymentLabel,
  paymentTone,
  statusLabel,
  statusTone,
  type BookingStatus,
  type NormalizedBooking,
  type PaymentStatus,
} from '../../lib/bookings';
import { formatDateLong, formatPesoExact } from '../../lib/format';
import { resolveReceiptUrl } from '../../lib/images';
import { saveBooking, type BookingChanges } from './shared';

interface BookingDetailProps {
  booking: NormalizedBooking;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (booking: NormalizedBooking) => void;
  onDeleted: (id: string) => void;
}

interface FormState {
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  transportationFee: string;
  photoStatus: string;
  driveLink: string;
  clientNote: string;
}

const toForm = (booking: NormalizedBooking): FormState => ({
  status: booking.status,
  paymentStatus: booking.paymentStatus,
  transportationFee: booking.transportationFee ? String(booking.transportationFee) : '',
  photoStatus: booking.photoStatus || '',
  driveLink: booking.driveLink,
  clientNote: booking.adminNote,
});

const isValidUrl = (value: string) => {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

export default function BookingDetail({ booking, canDelete, onClose, onSaved, onDeleted }: BookingDetailProps) {
  const [form, setForm] = useState<FormState>(() => toForm(booking));
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptState, setReceiptState] = useState<'loading' | 'ready' | 'none'>('loading');
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(toForm(booking));
  }, [booking]);

  useEffect(() => {
    let cancelled = false;
    setReceiptState('loading');
    resolveReceiptUrl(booking).then((url) => {
      if (cancelled) return;
      setReceiptUrl(url);
      setReceiptState(url ? 'ready' : 'none');
    });
    return () => {
      cancelled = true;
    };
  }, [booking]);

  const fee = Math.max(0, Number(form.transportationFee) || 0);
  const total = booking.baseSubtotal + fee;
  const balance = Math.max(total - booking.downpaymentAmount, 0);
  const driveInvalid = !isValidUrl(form.driveLink);
  const feeInvalid = form.transportationFee !== '' && (Number.isNaN(Number(form.transportationFee)) || Number(form.transportationFee) < 0);

  const original = useMemo(() => toForm(booking), [booking]);
  const dirty = (Object.keys(form) as (keyof FormState)[]).some((key) => form[key] !== original[key]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const changes: BookingChanges = {
    status: form.status,
    paymentStatus: form.paymentStatus,
    transportationFee: fee,
    photoStatus: form.photoStatus || undefined,
    driveLink: form.driveLink,
    clientNote: form.clientNote,
  };

  const handleSave = async () => {
    try {
      const saved = await saveBooking(booking, changes);
      onSaved(saved);
      setConfirmSave(false);
      toast.success(
        form.status === 'confirmed' && booking.status !== 'confirmed' ? 'Booking confirmed. The client is being emailed.' : 'Booking updated'
      );
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save this booking.'));
    }
  };

  const handleDelete = async () => {
    try {
      await callEdge(`/bookings/${booking.id}`, { method: 'DELETE' });
      onDeleted(booking.id);
      setConfirmDelete(false);
      toast.success('Booking deleted');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete this booking.'));
    }
  };

  const downloadReceipt = async () => {
    try {
      const { downloadBookingReceipt } = await import('../../lib/pdf');
      await downloadBookingReceipt(booking);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the receipt.'));
    }
  };

  const statusChanged = form.status !== booking.status;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="xl"
        icon={<CalendarDays size={22} />}
        title={booking.service}
        description={
          <span className="detail-sub">
            <span className="mono">{booking.reference}</span>
            <span className={`badge badge-${statusTone(booking.status)}`}>{statusLabel(booking.status)}</span>
            <span>Requested {new Date(booking.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </span>
        }
        className="booking-detail"
        footer={
          <>
            {canDelete && (
              <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Delete
              </button>
            )}
            <span className="footer-spacer" />
            {booking.status === 'completed' && (
              <button type="button" className="btn btn-ghost" onClick={downloadReceipt}>
                <FileDown size={16} /> Receipt PDF
              </button>
            )}
            <button type="button" className="btn btn-primary" disabled={!dirty || driveInvalid || feeInvalid} onClick={() => setConfirmSave(true)}>
              <Save size={16} /> Save changes
            </button>
          </>
        }
      >
        <div className="detail-grid">
          <section className="detail-block">
            <h3>Client</h3>
            <p className="detail-strong">{booking.fullName}</p>
            <ul className="detail-links">
              {booking.email && (
                <li>
                  <a href={`mailto:${booking.email}`}>
                    <Mail size={15} /> {booking.email}
                  </a>
                </li>
              )}
              {booking.phone && (
                <li>
                  <a href={`tel:${booking.phone.replace(/\s+/g, '')}`}>
                    <Phone size={15} /> {booking.phone}
                  </a>
                </li>
              )}
            </ul>
          </section>

          <section className="detail-block">
            <h3>Session</h3>
            <p className="detail-strong">{formatDateLong(booking.date)}</p>
            <p>
              {booking.time} · {booking.durationLabel}
            </p>
            {booking.location && (
              <a className="detail-map" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.location)}`} target="_blank" rel="noreferrer">
                <MapPin size={15} /> {booking.location} <ExternalLink size={13} />
              </a>
            )}
            {booking.message && <p className="detail-notes">“{booking.message}”</p>}
          </section>

          <section className="detail-block">
            <h3>Payment</h3>
            <dl className="meta-list">
              <div>
                <dt>Method</dt>
                <dd>{booking.paymentMethod}</dd>
              </div>
              <div>
                <dt>Reference no.</dt>
                <dd className="mono">{booking.paymentReference || '—'}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{booking.paymentSubmittedAt ? new Date(booking.paymentSubmittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd>
              </div>
            </dl>
            <div className="bd-receipt">
              {receiptState === 'loading' && (
                <span className="bd-receipt-empty">
                  <LoaderCircle size={16} className="spin" /> Loading receipt…
                </span>
              )}
              {receiptState === 'none' && <span className="bd-receipt-empty">No receipt uploaded</span>}
              {receiptState === 'ready' && receiptUrl && (
                <a href={receiptUrl} target="_blank" rel="noreferrer" title="Open receipt in a new tab">
                  <img src={receiptUrl} alt={`Payment receipt for ${booking.reference}`} />
                  <span>
                    <Download size={14} /> Open full size
                  </span>
                </a>
              )}
            </div>
            <div className="field">
              <label htmlFor="bd-payment">Payment status</label>
              <select
                id="bd-payment"
                value={form.paymentStatus}
                onChange={(event) => {
                  const value = event.target.value as PaymentStatus;
                  setForm((current) => ({
                    ...current,
                    paymentStatus: value,
                    status: value === 'verified' && current.status === 'pending' ? 'confirmed' : current.status,
                  }));
                }}
              >
                {PAYMENT_STATUSES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
              {form.paymentStatus === 'verified' && booking.status === 'pending' && form.status === 'confirmed' && (
                <span className="field-hint">Verifying the payment also confirms the booking. You can change that below.</span>
              )}
            </div>
          </section>

          <section className="detail-block">
            <h3>Pricing</h3>
            <dl className="meta-list">
              <div>
                <dt>
                  {formatPesoExact(booking.serviceRate)} × {booking.durationLabel}
                </dt>
                <dd>{formatPesoExact(booking.baseSubtotal)}</dd>
              </div>
            </dl>
            <div className="field">
              <label htmlFor="bd-fee">Transportation fee (₱)</label>
              <input
                id="bd-fee"
                type="number"
                inputMode="decimal"
                min={0}
                step={50}
                placeholder="0"
                value={form.transportationFee}
                aria-invalid={feeInvalid || undefined}
                onChange={(event) => set('transportationFee', event.target.value)}
              />
            </div>
            <dl className="money-list">
              <div>
                <dt>Total</dt>
                <dd>{formatPesoExact(total)}</dd>
              </div>
              <div>
                <dt>Downpayment</dt>
                <dd>
                  − {formatPesoExact(booking.downpaymentAmount)} <span className={`badge badge-${paymentTone(form.paymentStatus)}`}>{paymentLabel(form.paymentStatus)}</span>
                </dd>
              </div>
              <div className="is-total">
                <dt>Due on shoot day</dt>
                <dd>{formatPesoExact(balance)}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-block">
            <h3>Status</h3>
            <div className="field">
              <label htmlFor="bd-status">Booking status</label>
              <select id="bd-status" value={form.status} onChange={(event) => set('status', event.target.value as BookingStatus)}>
                {BOOKING_STATUSES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
              {statusChanged && form.status === 'confirmed' && <span className="field-hint">The client gets a confirmation email when you save.</span>}
              {statusChanged && form.status === 'cancelled' && (
                <span className="field-hint">No email is sent for cancellations yet. Let the client know directly.</span>
              )}
              {statusChanged && form.status === 'completed' && <span className="field-hint">An official receipt number is issued when you save.</span>}
            </div>
            <div className="field">
              <label htmlFor="bd-note">
                Note to client <span className="optional">(shown in their Bookings tab)</span>
              </label>
              <textarea
                id="bd-note"
                rows={3}
                maxLength={500}
                placeholder="e.g. Transportation fee covers a round trip from Quezon City."
                value={form.clientNote}
                onChange={(event) => set('clientNote', event.target.value)}
              />
            </div>
          </section>

          <section className="detail-block">
            <h3>Photo delivery</h3>
            <div className="field">
              <label htmlFor="bd-photo">Photo status</label>
              <select id="bd-photo" value={form.photoStatus} onChange={(event) => set('photoStatus', event.target.value)}>
                <option value="">Not started</option>
                {PHOTO_STATUSES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bd-drive">Google Drive link</label>
              <input
                id="bd-drive"
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/…"
                value={form.driveLink}
                aria-invalid={driveInvalid || undefined}
                onChange={(event) => set('driveLink', event.target.value)}
              />
              {driveInvalid ? (
                <span className="field-error">Enter a full link starting with https://</span>
              ) : (
                <span className="field-hint">The client sees this link in their account as soon as you save.</span>
              )}
            </div>
          </section>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmSave}
        title="Save booking changes?"
        message={`${booking.fullName} · ${booking.reference}`}
        confirmLabel="Save changes"
        onConfirm={handleSave}
        onCancel={() => setConfirmSave(false)}
      >
        <dl className="confirm-list">
          {statusChanged && (
            <div>
              <dt>Status</dt>
              <dd>
                {statusLabel(booking.status)} → {statusLabel(form.status)}
              </dd>
            </div>
          )}
          {form.paymentStatus !== booking.paymentStatus && (
            <div>
              <dt>Payment</dt>
              <dd>
                {paymentLabel(booking.paymentStatus)} → {paymentLabel(form.paymentStatus)}
              </dd>
            </div>
          )}
          <div>
            <dt>Total</dt>
            <dd>{formatPesoExact(total)}</dd>
          </div>
          <div>
            <dt>Due on shoot day</dt>
            <dd>{formatPesoExact(balance)}</dd>
          </div>
        </dl>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title="Delete this booking?"
        message={`${booking.fullName} · ${booking.service} on ${booking.dateDisplay}. This cannot be undone. Consider marking it Cancelled instead to keep the record.`}
        confirmLabel="Delete booking"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
