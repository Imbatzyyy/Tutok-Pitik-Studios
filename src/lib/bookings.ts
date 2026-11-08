import { formatDateLong, formatPesoExact, formatTime, hoursLabel } from './format';

// Booking extras (payment, delivery, receipt) are stored as JSON after this marker
// inside bookings.message, so existing rows keep working without schema changes.
export const BOOKING_META_MARKER = '\n\n---BOOKING_META---\n';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PaymentStatus = 'submitted' | 'verified' | 'rejected';
export type PhotoStatus = 'editing' | 'ready' | 'delivered';

export const BOOKING_STATUSES: { value: BookingStatus; label: string; tone: string }[] = [
  { value: 'pending', label: 'Pending review', tone: 'warning' },
  { value: 'confirmed', label: 'Confirmed', tone: 'success' },
  { value: 'completed', label: 'Completed', tone: 'info' },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger' },
];

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string; tone: string }[] = [
  { value: 'submitted', label: 'Awaiting review', tone: 'warning' },
  { value: 'verified', label: 'Verified', tone: 'success' },
  { value: 'rejected', label: 'Rejected', tone: 'danger' },
];

export const PHOTO_STATUSES: { value: PhotoStatus; label: string }[] = [
  { value: 'editing', label: 'Editing' },
  { value: 'ready', label: 'Ready for delivery' },
  { value: 'delivered', label: 'Delivered' },
];

export const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed'];

export const statusLabel = (status?: string) => BOOKING_STATUSES.find((entry) => entry.value === status)?.label || 'Pending review';
export const statusTone = (status?: string) => BOOKING_STATUSES.find((entry) => entry.value === status)?.tone || 'warning';
export const paymentLabel = (status?: string) => PAYMENT_STATUSES.find((entry) => entry.value === status)?.label || 'Awaiting review';
export const paymentTone = (status?: string) => PAYMENT_STATUSES.find((entry) => entry.value === status)?.tone || 'warning';
export const photoLabel = (status?: string) => PHOTO_STATUSES.find((entry) => entry.value === status)?.label || 'Editing';

export const parseBookingMessage = (message?: string | null) => {
  if (!message || !message.includes(BOOKING_META_MARKER)) {
    return { plainMessage: message || '', meta: {} as Record<string, any> };
  }
  const [plainMessage, rawMeta] = message.split(BOOKING_META_MARKER);
  try {
    return { plainMessage: plainMessage || '', meta: rawMeta ? JSON.parse(rawMeta) : {} };
  } catch {
    return { plainMessage: message || '', meta: {} as Record<string, any> };
  }
};

export const buildBookingMessage = (plainMessage: string, meta: Record<string, any>) => {
  const sanitizedMessage = (plainMessage || '').trim();
  const cleanMeta = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  if (Object.keys(cleanMeta).length === 0) return sanitizedMessage;
  return `${sanitizedMessage}${BOOKING_META_MARKER}${JSON.stringify(cleanMeta)}`;
};

export const getReceiptNumber = (booking: any) => {
  const date = new Date(booking.created_at || booking.createdAt || Date.now());
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `TPS-${stamp}-${String(booking.id || '').slice(0, 6).toUpperCase()}`;
};

export const bookingReference = (booking: any) => `TPS-${String(booking.id || '').slice(0, 6).toUpperCase()}`;

export interface NormalizedBooking {
  id: string;
  raw: any;
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  service: string;
  date: string;
  dateDisplay: string;
  startTime: string;
  endTime: string;
  time: string;
  durationHours: number;
  durationLabel: string;
  location: string;
  message: string;
  meta: Record<string, any>;
  status: BookingStatus;
  serviceRate: number;
  baseSubtotal: number;
  transportationFee: number;
  totalAmount: number;
  totalLabel: string;
  downpaymentAmount: number;
  remainingBalance: number;
  createdAt: string;
  updatedAt?: string;
  reference: string;
  receiptNumber: string;
  receiptIssuedAt?: string;
  driveLink: string;
  photoStatus: string;
  paymentMethod: string;
  paymentReference: string;
  paymentReceiptUrl: string;
  paymentReceiptPath: string;
  paymentReceiptName: string;
  paymentStatus: PaymentStatus;
  paymentSubmittedAt?: string;
  adminNote: string;
}

export const normalizeBooking = (record: any): NormalizedBooking => {
  const { plainMessage, meta } = parseBookingMessage(record.message);
  const date = record.booking_date || record.date || '';
  const startTime = record.start_time || record.startTime || '';
  const endTime = record.end_time || record.endTime || '';
  const durationHours = Number(record.duration || 0) || 0;
  const serviceRate = Number(record.price || 0) || 0;
  const transportationFee = Number(record.transportation_fee ?? record.transportation ?? 0) || 0;
  const totalFromRow = Number(record.total_price ?? record.totalPrice ?? 0) || 0;
  const baseSubtotal = serviceRate > 0 && durationHours > 0 ? serviceRate * durationHours : Math.max(totalFromRow - transportationFee, 0);
  const totalAmount = totalFromRow || baseSubtotal + transportationFee;
  const downpaymentAmount = Number(meta.downpaymentAmount ?? meta.downpayment ?? baseSubtotal / 2) || 0;
  const remainingBalance = Math.max(totalAmount - downpaymentAmount, 0);
  const fullName = record.full_name || record.fullName || [record.firstName, record.lastName].filter(Boolean).join(' ') || 'Customer';
  const status = (['pending', 'confirmed', 'completed', 'cancelled'].includes(record.status) ? record.status : 'pending') as BookingStatus;

  return {
    id: String(record.id || ''),
    raw: record,
    userId: record.user_id,
    fullName,
    email: record.email || '',
    phone: record.phone || '',
    service: record.service || 'Photography Session',
    date,
    dateDisplay: date ? formatDateLong(date) : 'TBD',
    startTime,
    endTime,
    time: startTime && endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : record.time || 'TBD',
    durationHours,
    durationLabel: durationHours ? hoursLabel(durationHours) : 'TBD',
    location: record.location || '',
    message: plainMessage,
    meta,
    status,
    serviceRate,
    baseSubtotal,
    transportationFee,
    totalAmount,
    totalLabel: formatPesoExact(totalAmount),
    downpaymentAmount,
    remainingBalance,
    createdAt: record.created_at || record.createdAt || new Date().toISOString(),
    updatedAt: record.updated_at,
    reference: bookingReference(record),
    receiptNumber: meta.receiptNumber || getReceiptNumber(record),
    receiptIssuedAt: meta.completedAt || record.updated_at || record.created_at,
    driveLink: meta.driveLink || '',
    photoStatus: meta.photoStatus || (status === 'completed' ? 'editing' : ''),
    paymentMethod: meta.paymentMethod || 'GCash',
    paymentReference: meta.paymentReference || '',
    paymentReceiptUrl: meta.paymentReceiptUrl || '',
    paymentReceiptPath: meta.paymentReceiptPath || '',
    paymentReceiptName: meta.paymentReceiptName || '',
    paymentStatus: (['submitted', 'verified', 'rejected'].includes(meta.paymentStatus) ? meta.paymentStatus : 'submitted') as PaymentStatus,
    paymentSubmittedAt: meta.paymentSubmittedAt || record.created_at,
    adminNote: meta.adminNote || '',
  };
};

export const isActiveBooking = (booking: { status?: string }) => ACTIVE_STATUSES.includes((booking.status || 'pending') as BookingStatus);
