import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  CalendarOff,
  ChartColumn,
  History,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import logo from '../../assets/logo-160.png';
import { useModal } from '../../hooks/useModal';
import { initials } from '../../lib/format';
import type { SessionUser } from '../../lib/session';
import { confirmNavigation, hasUnsavedChanges, rpc, useStudioLive, type BookingTab } from '../../lib/studio';
import { supabase } from '../../lib/supabase';
import '../../styles/studio-operations.css';
import ConfirmDialog from '../common/ConfirmDialog';
import ActivityView from './operations/ActivityView';
import BookingsView from './operations/BookingsView';
import ClientsView from './operations/ClientsView';
import InboxView, { inboxSeenAt } from './operations/InboxView';
import NotificationsView from './operations/NotificationsView';
import OverviewView, { type BookingPreset } from './operations/OverviewView';
import ReportsView from './operations/ReportsView';
import ScheduleView from './operations/ScheduleView';
import SecurityView from './operations/SecurityView';
import TeamView from './operations/TeamView';
import PortfolioTab from './PortfolioTab';
import TestimonialsTab from './TestimonialsTab';
import { canAccess, ROLE_LABELS, type AdminTabId } from './shared';

interface AdminDashboardProps {
  user: SessionUser;
  onClose: () => void;
  onPortfolioUpdated?: () => Promise<void> | void;
  onLogout: () => void | Promise<void>;
  /** From the URL: /admin/<tab> or /admin/bookings/<id>. */
  initialTab?: string;
  initialBookingId?: string;
  /** Keeps the address bar in step with the open tab and booking. */
  onLocationChange?: (tab: AdminTabId, bookingId?: string | null) => void;
}

type NavItem = { id: AdminTabId; label: string; icon: LucideIcon };
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Daily work',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'bookings', label: 'Bookings', icon: CalendarDays },
      { id: 'payments', label: 'Payments', icon: Wallet },
      { id: 'customers', label: 'Clients', icon: UserRound },
    ],
  },
  {
    title: 'Messages',
    items: [
      { id: 'inbox', label: 'Inquiries', icon: Inbox },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Studio',
    items: [
      { id: 'availability', label: 'Availability', icon: CalendarOff },
      { id: 'portfolio', label: 'Portfolio', icon: Images },
      { id: 'reviews', label: 'Testimonials', icon: MessageSquareQuote },
    ],
  },
  {
    title: 'Insights & admin',
    items: [
      { id: 'reports', label: 'Reports', icon: ChartColumn },
      { id: 'activity', label: 'Activity', icon: History },
      { id: 'security', label: 'Security & health', icon: ShieldCheck },
      { id: 'users', label: 'Accounts & roles', icon: Users },
    ],
  },
];
const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
const BADGE_HINTS: Partial<Record<AdminTabId, string>> = { bookings: 'pending', payments: 'to review', inbox: 'new', notifications: 'unread' };
const presetFor = (tab: AdminTabId): BookingPreset => (tab === 'payments' ? { view: 'payments' } : {});

type Counts = Partial<Record<AdminTabId, number>>;

export default function AdminDashboard({ user, onClose, onPortfolioUpdated, onLogout, initialTab, initialBookingId, onLocationChange }: AdminDashboardProps) {
  const allowed = useCallback((id: AdminTabId) => canAccess(user.role, id), [user.role]);
  const groups = useMemo(() => NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => allowed(item.id)) })).filter((group) => group.items.length), [allowed]);
  const [active, setActive] = useState<AdminTabId>(() => {
    const requested = (initialBookingId ? 'bookings' : initialTab) as AdminTabId | undefined;
    return requested && allowed(requested) ? requested : groups[0]?.items[0]?.id || 'bookings';
  });
  const [preset, setPreset] = useState(() => ({ key: 0, filters: presetFor(active) }));
  const [focusBookingId, setFocusBookingId] = useState<string | null>(initialBookingId && allowed('bookings') ? initialBookingId : null);
  const [focusTab, setFocusTab] = useState<BookingTab | undefined>();
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutHasChanges, setLogoutHasChanges] = useState(false);
  const [revision, setRevision] = useState(0);
  const [counts, setCounts] = useState<Counts>({});
  const menuRef = useModal<HTMLElement>(menuOpen, () => setMenuOpen(false));

  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const live = useStudioLive(user.id, true, refresh);

  useEffect(() => {
    onLocationChange?.(active, active === 'bookings' || active === 'payments' ? openBookingId || focusBookingId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, openBookingId]);

  useEffect(() => {
    const resize = () => {
      if (window.innerWidth > 960) setMenuOpen(false);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Sidebar counters: what is waiting in each section. Each one fails quietly on its own.
  const loadCounts = useCallback(async () => {
    const next: Counts = {};
    const jobs: Promise<void>[] = [
      rpc<Record<string, number>>('studio_overview').then((o) => {
        next.bookings = Number(o?.pending) || 0;
        next.payments = Number(o?.unreviewed) || 0;
      }),
      Promise.resolve(supabase.from('studio_notifications').select('id').is('read_at', null).limit(100)).then(({ data, error }) => {
        if (!error) next.notifications = data?.length || 0;
      }),
    ];
    if (canAccess(user.role, 'inbox')) {
      const since = inboxSeenAt() || new Date(Date.now() - 7 * 864e5).toISOString();
      jobs.push(
        Promise.resolve(supabase.from('contact_messages').select('id').gt('created_at', since).limit(100)).then(({ data, error }) => {
          if (!error) next.inbox = data?.length || 0;
        })
      );
    }
    await Promise.allSettled(jobs);
    setCounts(next);
  }, [user.role]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts, revision]);

  const onInboxSeen = useCallback(() => setCounts((c) => ({ ...c, inbox: 0 })), []);
  const onNotificationsRead = useCallback(() => void loadCounts(), [loadCounts]);

  const go = async (id: AdminTabId) => {
    if (!(await confirmNavigation())) return;
    setActive(id);
    setMenuOpen(false);
    setFocusBookingId(null);
    setFocusTab(undefined);
    setOpenBookingId(null);
    if (id === 'bookings' || id === 'payments') setPreset((p) => ({ key: p.key + 1, filters: presetFor(id) }));
    document.getElementById('admin-main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  };

  const openBooking = (id: string, tab?: BookingTab) => {
    setFocusBookingId(id);
    setFocusTab(tab);
    setOpenBookingId(id);
    setActive((current) => (current === 'payments' ? 'payments' : 'bookings'));
    window.scrollTo({ top: 0 });
  };

  const openView = (filters: BookingPreset) => {
    setFocusBookingId(null);
    setFocusTab(undefined);
    setOpenBookingId(null);
    setPreset((p) => ({ key: p.key + 1, filters }));
    setActive('bookings');
    window.scrollTo({ top: 0 });
  };

  const leave = async () => {
    if (await confirmNavigation()) onClose();
  };

  const current = ALL_ITEMS.find((item) => item.id === active);
  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const avatar = user.profilePicture ? <img src={user.profilePicture} alt="" /> : initials(user.fullName);
  const badge = (n?: number) => (n && n > 99 ? '99+' : String(n || ''));

  return (
    <div className={`admin-shell studio-workspace ${menuOpen ? 'studio-menu-open' : ''}`}>
      <a className="skip-link" href="#admin-main">
        Skip to workspace
      </a>
      {menuOpen && <button type="button" className="studio-nav-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <aside ref={menuRef} className="admin-sidebar" aria-label="Studio navigation">
        <div className="admin-brand">
          <img className="studio-brand-logo" src={logo} alt="" />
          <div>
            <strong>Tutok Pitik</strong>
            <span>Studio workspace</span>
          </div>
          <button type="button" className="icon-btn admin-close-mobile" onClick={() => setMenuOpen(false)} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>

        <nav className="admin-nav" aria-label="Workspace sections">
          {groups.map((group) => (
            <div className="admin-nav-group" key={group.title}>
              <p className="studio-nav-label">{group.title}</p>
              {group.items.map(({ id, label, icon: Icon }) => {
                const count = counts[id] || 0;
                return (
                  <button key={id} type="button" className={active === id ? 'is-active' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => void go(id)}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                    {count > 0 && (
                      <span className={`admin-nav-count ${id === 'payments' || id === 'bookings' ? 'is-urgent' : ''}`} aria-label={`${count} ${BADGE_HINTS[id] || ''}`}>
                        {badge(count)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-me">
            <span className="avatar">{avatar}</span>
            <div>
              <strong>{user.fullName}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>
          <div className="admin-foot-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void leave()}>
              <ArrowUpRight size={16} aria-hidden="true" /> Website
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm admin-signout"
              onClick={() => {
                setLogoutHasChanges(hasUnsavedChanges());
                setLogoutOpen(true);
              }}
            >
              <LogOut size={16} aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="studio-workspace-body">
        <header className="studio-topbar">
          <div>
            <button type="button" className="icon-btn studio-menu-toggle" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <Menu size={21} />
            </button>
            <span className="studio-breadcrumb">
              <span className="studio-breadcrumb-root">Workspace</span>
              <span aria-hidden="true" className="studio-breadcrumb-root">
                /
              </span>{' '}
              <strong>{current?.label}</strong>
            </span>
          </div>
          <div className="studio-topbar-actions">
            <span className={`studio-sync ops-live-${live.toLowerCase()}`} role="status" title="Live updates">
              <i aria-hidden="true" />
              <span>{live}</span>
            </span>
            <button type="button" className="icon-btn" aria-label="Refresh data" title="Refresh data" onClick={refresh}>
              <RefreshCw size={17} />
            </button>
            <span className="studio-role">{roleLabel}</span>
            <span className="avatar studio-topbar-avatar" title={user.fullName}>
              {avatar}
            </span>
          </div>
        </header>

        <main className="admin-main" id="admin-main" tabIndex={-1}>
          {active === 'overview' && <OverviewView user={user} revision={revision} onOpen={openBooking} onView={openView} onNavigate={(tab) => void go(tab)} />}
          {(active === 'bookings' || active === 'payments') && (
            <BookingsView
              user={user}
              revision={revision}
              preset={preset}
              mode={active}
              focusId={focusBookingId}
              focusTab={focusTab}
              onOpenChange={(id) => {
                setOpenBookingId(id);
                if (!id) {
                  setFocusBookingId(null);
                  setFocusTab(undefined);
                }
              }}
            />
          )}
          {active === 'customers' && <ClientsView revision={revision} onOpen={openBooking} />}
          {active === 'reports' && <ReportsView revision={revision} />}
          {active === 'notifications' && <NotificationsView revision={revision} admin={user.role !== 'staff'} onOpen={openBooking} onRead={onNotificationsRead} />}
          {active === 'security' && <SecurityView user={user} revision={revision} />}
          {active === 'users' && <TeamView user={user} revision={revision} />}
          {active === 'activity' && <ActivityView key={revision} onOpen={openBooking} />}
          {active === 'inbox' && <InboxView key={revision} onSeen={onInboxSeen} />}
          {active === 'portfolio' && <PortfolioTab user={user} onChanged={onPortfolioUpdated} />}
          {active === 'availability' && <ScheduleView revision={revision} />}
          {active === 'reviews' && <TestimonialsTab />}
        </main>

        <footer className="studio-workspace-footer">
          <span>Tutok Pitik Studios · Studio workspace</span>
          <span>Times shown in Manila (PHT)</span>
        </footer>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Sign out of the workspace?"
        message={logoutHasChanges ? 'You have unsaved changes. Signing out will discard them. You’ll need to sign in again to open the workspace.' : 'You’ll need to sign in again to open the studio workspace.'}
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        autoFocus="cancel"
        icon={<LogOut size={22} />}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={onLogout}
      />
    </div>
  );
}
