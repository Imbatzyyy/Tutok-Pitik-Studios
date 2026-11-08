import { notify } from '../../lib/api';
import {
  buildBookingMessage,
  getReceiptNumber,
  normalizeBooking,
  parseBookingMessage,
  type BookingStatus,
  type NormalizedBooking,
  type PaymentStatus,
} from '../../lib/bookings';
import type { SessionUser } from '../../lib/session';
import { supabase } from '../../lib/supabase';

export type AdminRole = SessionUser['role'];
export type AdminTabId = 'overview' | 'bookings' | 'users' | 'portfolio' | 'availability' | 'reviews';

export const TAB_ROLES: Record<AdminTabId, AdminRole[]> = {
  overview: ['superadmin'],
  bookings: ['superadmin', 'admin', 'staff'],
  users: ['superadmin'],
  portfolio: ['superadmin', 'admin'],
  availability: ['superadmin', 'admin'],
  reviews: ['superadmin', 'admin'],
};

export const canAccess = (role: AdminRole, tab: AdminTabId) => TAB_ROLES[tab].includes(role);

export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super admin',
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
};

export const ROLE_TONES: Record<string, string> = {
  superadmin: 'danger',
  admin: 'info',
  staff: 'warning',
  customer: 'neutral',
};

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  username: string;
  phone: string;
  role: string;
  status: 'active' | 'inactive';
  profilePicture: string;
  joinDate: string;
}

export const normalizeUser = (record: any): AdminUser => ({
  id: String(record.id || ''),
  fullName:
    record.full_name || record.fullName || [record.firstName, record.lastName].filter(Boolean).join(' ').trim() || 'Unknown user',
  email: record.email || '',
  username: record.username || '',
  phone: record.phone || '',
  role: record.role === 'super_admin' ? 'superadmin' : record.role || 'customer',
  status: record.status === 'inactive' ? 'inactive' : 'active',
  profilePicture: record.profile_picture_url || record.profilePicture || '',
  joinDate: record.created_at || record.joinDate || '',
});

export interface BookingChanges {
  status?: BookingStatus;
  transportationFee?: number;
  paymentStatus?: PaymentStatus;
  photoStatus?: string;
  driveLink?: string;
  clientNote?: string;
}

/**
 * Persist admin changes to a booking. Extras live in the message meta block so
 * the existing table keeps working. Sends the confirmation email when a booking
 * moves to "confirmed".
 */
export async function saveBooking(booking: NormalizedBooking, changes: BookingChanges): Promise<NormalizedBooking> {
  const { plainMessage, meta } = parseBookingMessage(booking.raw?.message);
  const nextStatus = changes.status ?? booking.status;
  const transportationFee = Math.max(0, Number(changes.transportationFee ?? booking.transportationFee) || 0);
  const totalAmount = booking.baseSubtotal + transportationFee;
  const downpaymentAmount = booking.downpaymentAmount;

  const nextMeta: Record<string, any> = {
    ...meta,
    paymentStatus: changes.paymentStatus ?? meta.paymentStatus,
    photoStatus: changes.photoStatus ?? meta.photoStatus,
    driveLink: changes.driveLink !== undefined ? changes.driveLink.trim() : meta.driveLink,
    adminNote: changes.clientNote !== undefined ? changes.clientNote.trim() : meta.adminNote,
    downpaymentAmount,
    remainingBalance: Math.max(totalAmount - downpaymentAmount, 0),
    confirmedTotal: totalAmount,
  };

  if (nextStatus === 'completed') {
    nextMeta.receiptNumber = meta.receiptNumber || getReceiptNumber(booking.raw || { id: booking.id });
    nextMeta.completedAt = meta.completedAt || new Date().toISOString();
    nextMeta.photoStatus = nextMeta.photoStatus || 'editing';
  }

  const message = buildBookingMessage(plainMessage, nextMeta);
  const update = {
    status: nextStatus,
    transportation_fee: transportationFee,
    total_price: totalAmount,
    message,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('bookings').update(update).eq('id', booking.id).select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This booking could not be updated. Your account may not have permission.');

  if (nextStatus === 'confirmed' && booking.status !== 'confirmed') {
    void notify('/send-booking-confirmation-email', { booking: data });
  }

  return normalizeBooking(data);
}

export const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const addDaysKey = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const includesText = (haystack: (string | undefined | null)[], needle: string) => {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  return haystack.some((value) => String(value || '').toLowerCase().includes(query));
};
