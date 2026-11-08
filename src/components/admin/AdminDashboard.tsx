import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarOff, ChartColumn, Images, LogOut, MessageSquareQuote, Users, X, type LucideIcon } from 'lucide-react';
import { useModal } from '../../hooks/useModal';
import { normalizeBooking, type NormalizedBooking } from '../../lib/bookings';
import { initials } from '../../lib/format';
import type { SessionUser } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import AvailabilityTab from './AvailabilityTab';
import BookingsTab from './BookingsTab';
import OverviewTab from './OverviewTab';
import PortfolioTab from './PortfolioTab';
import TestimonialsTab from './TestimonialsTab';
import UsersTab from './UsersTab';
import { canAccess, normalizeUser, ROLE_LABELS, type AdminTabId, type AdminUser } from './shared';

interface AdminDashboardProps {
  user: SessionUser;
  onClose: () => void;
  onPortfolioUpdated?: () => Promise<void> | void;
  onLogout: () => void;
}

const NAV: { id: AdminTabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: ChartColumn },
  { id: 'bookings', label: 'Bookings', icon: CalendarDays },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'portfolio', label: 'Portfolio', icon: Images },
  { id: 'availability', label: 'Availability', icon: CalendarOff },
  { id: 'reviews', label: 'Testimonials', icon: MessageSquareQuote },
];

export type LoadState = 'loading' | 'ready' | 'error';

export default function AdminDashboard({ user, onClose, onPortfolioUpdated, onLogout }: AdminDashboardProps) {
  const tabs = useMemo(() => NAV.filter((tab) => canAccess(user.role, tab.id)), [user.role]);
  const [active, setActive] = useState<AdminTabId>(tabs[0]?.id || 'bookings');
  const [focusBookingId, setFocusBookingId] = useState<string | null>(null);
  const ref = useModal<HTMLDivElement>(true, undefined, { autoFocus: false });

  const [bookings, setBookings] = useState<NormalizedBooking[]>([]);
  const [bookingsState, setBookingsState] = useState<LoadState>('loading');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersState, setUsersState] = useState<LoadState>('loading');

  const needsBookings = canAccess(user.role, 'bookings');
  const needsUsers = canAccess(user.role, 'users');

  const loadBookings = useCallback(async () => {
    if (!needsBookings) return;
    setBookingsState((state) => (state === 'ready' ? state : 'loading'));
    const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Could not load bookings:', error);
      setBookingsState('error');
      return;
    }
    setBookings((data || []).map(normalizeBooking));
    setBookingsState('ready');
  }, [needsBookings]);

  const loadUsers = useCallback(async () => {
    if (!needsUsers) return;
    setUsersState((state) => (state === 'ready' ? state : 'loading'));
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Could not load users:', error);
      setUsersState('error');
      return;
    }
    setUsers((data || []).map(normalizeUser));
    setUsersState('ready');
  }, [needsUsers]);

  useEffect(() => {
    void loadBookings();
    void loadUsers();
  }, [loadBookings, loadUsers]);

  const replaceBooking = useCallback((next: NormalizedBooking) => {
    setBookings((current) => current.map((booking) => (booking.id === next.id ? next : booking)));
  }, []);

  const removeBooking = useCallback((id: string) => {
    setBookings((current) => current.filter((booking) => booking.id !== id));
  }, []);

  const openBooking = (id: string) => {
    setFocusBookingId(id);
    setActive('bookings');
  };

  const pendingCount = bookings.filter((booking) => booking.status === 'pending').length;

  return (
    <div className="admin-shell" ref={ref} role="dialog" aria-modal="true" aria-label="Studio dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">TP</span>
          <div>
            <strong>Studio dashboard</strong>
            <span>{ROLE_LABELS[user.role] || 'Team'}</span>
          </div>
          <button type="button" className="icon-btn admin-close-mobile" onClick={onClose} aria-label="Close dashboard">
            <X size={20} />
          </button>
        </div>

        <nav className="admin-nav" aria-label="Dashboard sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={active === id ? 'is-active' : ''}
              aria-current={active === id ? 'page' : undefined}
              onClick={() => setActive(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'bookings' && pendingCount > 0 && (
                <span className="admin-nav-count" aria-label={`${pendingCount} pending`}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-me">
            <span className="avatar">
              {user.profilePicture ? <img src={user.profilePicture} alt="" /> : initials(user.fullName)}
            </span>
            <div>
              <strong>{user.fullName}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={onClose}>
            <X size={16} /> Back to website
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-block admin-signout" onClick={onLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main" id="admin-main">
        {active === 'overview' && (
          <OverviewTab bookings={bookings} bookingsState={bookingsState} users={users} onOpenBooking={openBooking} onRefresh={loadBookings} />
        )}
        {active === 'bookings' && (
          <BookingsTab
            user={user}
            bookings={bookings}
            state={bookingsState}
            onReload={loadBookings}
            onReplace={replaceBooking}
            onRemove={removeBooking}
            focusId={focusBookingId}
            onFocusHandled={() => setFocusBookingId(null)}
          />
        )}
        {active === 'users' && <UsersTab currentUser={user} users={users} state={usersState} onReload={loadUsers} />}
        {active === 'portfolio' && <PortfolioTab user={user} onChanged={onPortfolioUpdated} />}
        {active === 'availability' && <AvailabilityTab bookings={bookings} />}
        {active === 'reviews' && <TestimonialsTab />}
      </main>
    </div>
  );
}
