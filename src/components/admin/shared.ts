import type { SessionUser } from '../../lib/session';

export type AdminRole = SessionUser['role'];
export type AdminTabId = 'overview' | 'bookings' | 'users' | 'portfolio' | 'availability' | 'reviews' | 'payments' | 'customers' | 'activity' | 'inbox' | 'notifications' | 'reports' | 'security';

/** Which team roles can open each workspace section. The database enforces the same rules. */
export const TAB_ROLES: Record<AdminTabId, AdminRole[]> = {
  overview: ['superadmin', 'admin', 'staff'],
  bookings: ['superadmin', 'admin', 'staff'],
  payments: ['superadmin', 'admin'],
  customers: ['superadmin', 'admin'],
  inbox: ['superadmin', 'admin'],
  notifications: ['superadmin', 'admin', 'staff'],
  availability: ['superadmin', 'admin'],
  portfolio: ['superadmin', 'admin'],
  reviews: ['superadmin', 'admin'],
  reports: ['superadmin', 'admin'],
  activity: ['superadmin', 'admin', 'staff'],
  security: ['superadmin', 'admin', 'staff'],
  users: ['superadmin'],
};

export const canAccess = (role: AdminRole, tab: AdminTabId) => TAB_ROLES[tab].includes(role);

export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super admin',
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
};

export { addDaysKey, todayKey } from '../../lib/studio';

export type LoadState = 'loading' | 'ready' | 'error';
