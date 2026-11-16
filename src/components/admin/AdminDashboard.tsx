import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarOff, ChartColumn, Images, LogOut, MessageSquareQuote, Users, X, Menu, ArrowUpRight, RefreshCw, Wallet, Activity, Inbox, UserRound, type LucideIcon } from 'lucide-react';
import { useModal } from '../../hooks/useModal';
import logo from '../../assets/logo-160.png';
import { PaymentsView, CustomersView, ActivityView, InboxView } from './StudioViews';
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
import { resolveAvatarUrl } from '../../lib/images';

interface AdminDashboardProps {
  user: SessionUser;
  onClose: () => void;
  onPortfolioUpdated?: () => Promise<void> | void;
  onLogout: () => void;
  /** From the URL: /admin/<tab> or /admin/bookings/<id>. */
  initialTab?: string;
  initialBookingId?: string;
  /** Keeps the address bar in step with the open tab and booking. */
  onLocationChange?: (tab: AdminTabId, bookingId?: string | null) => void;
}

const NAV: { id: AdminTabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: ChartColumn },
  { id: 'bookings', label: 'Bookings', icon: CalendarDays },
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'customers', label: 'Clients', icon: UserRound },
  { id: 'users', label: 'Accounts & roles', icon: Users },
  { id: 'portfolio', label: 'Portfolio', icon: Images },
  { id: 'availability', label: 'Availability', icon: CalendarOff },
  { id: 'reviews', label: 'Testimonials', icon: MessageSquareQuote },
  { id: 'inbox', label: 'Inquiries', icon: Inbox },
  { id: 'activity', label: 'Activity', icon: Activity },
];

export type LoadState = 'loading' | 'ready' | 'error';

export default function AdminDashboard({ user, onClose, onPortfolioUpdated, onLogout, initialTab, initialBookingId, onLocationChange }: AdminDashboardProps) {
  const tabs = useMemo(() => NAV.filter((tab) => canAccess(user.role, tab.id)), [user.role]);
  const [active, setActive] = useState<AdminTabId>(() => {
    const requested = initialBookingId ? 'bookings' : initialTab;
    return tabs.find((tab) => tab.id === requested)?.id || tabs[0]?.id || 'bookings';
  });
  const [focusBookingId, setFocusBookingId] = useState<string | null>(initialBookingId && canAccess(user.role, 'bookings') ? initialBookingId : null);
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);

  useEffect(() => {
    onLocationChange?.(active, active === 'bookings' ? openBookingId || focusBookingId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, openBookingId]);
  const [menuOpen,setMenuOpen]=useState(false);
  const menuRef=useModal<HTMLElement>(menuOpen,()=>setMenuOpen(false));
  useEffect(()=>{const resize=()=>{if(window.innerWidth>960)setMenuOpen(false);};window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  const [refreshing,setRefreshing]=useState(false);
  const [updated,setUpdated]=useState<Date|null>(null);

  const [bookings, setBookings] = useState<NormalizedBooking[]>([]);
  const [bookingsState, setBookingsState] = useState<LoadState>('loading');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersState, setUsersState] = useState<LoadState>('loading');

  const needsBookings = canAccess(user.role, 'bookings');
  const needsUsers = canAccess(user.role, 'users');

  const loadBookings = useCallback(async () => {
    if (!needsBookings) return;
    setBookingsState((state) => (state === 'ready' ? state : 'loading'));
    const { data, error } = await loadAll('bookings');
    if (error) {
      console.error('Could not load bookings:', error);
      setBookingsState('error');
      return;
    }
    setBookings((data || []).map(normalizeBooking));
    setBookingsState('ready');
    setUpdated(new Date());
  }, [needsBookings]);

  const loadUsers = useCallback(async () => {
    if (!needsUsers) return;
    setUsersState((state) => (state === 'ready' ? state : 'loading'));
    const { data, error } = await loadAll('users');
    if (error) {
      console.error('Could not load users:', error);
      setUsersState('error');
      return;
    }
    setUsers(await Promise.all((data || []).map(async (row) => ({ ...normalizeUser(row), profilePicture: await resolveAvatarUrl(row.profile_picture_url) }))));
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

  const refresh = async () => { setRefreshing(true); try { await Promise.all([loadBookings(),loadUsers()]); } finally { setRefreshing(false); } };
  useEffect(() => {
    const timer=window.setInterval(()=>{if(!document.hidden)void loadBookings();},60_000);
    const visible=()=>{if(!document.hidden)void loadBookings();};
    document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[loadBookings]);
  const pendingCount = bookings.filter((booking) => booking.status === 'pending').length;

  return (
    <div className={`admin-shell studio-workspace ${menuOpen?'studio-menu-open':''}`}>
      <a className="skip-link" href="#admin-main">Skip to workspace</a>
      {menuOpen&&<button className="studio-nav-backdrop" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}/>}
      <aside ref={menuRef} className="admin-sidebar" aria-label="Studio navigation">
        <div className="admin-brand">
          <img className="studio-brand-logo" src={logo} alt=""/>
          <div>
            <strong>Tutok Pitik</strong>
            <span>STUDIO WORKSPACE</span>
          </div>
          <button type="button" className="icon-btn admin-close-mobile" onClick={()=>setMenuOpen(false)} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>

        <p className="studio-nav-label">WORKSPACE</p>
        <nav className="admin-nav" aria-label="Dashboard sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={active === id ? 'is-active' : ''}
              aria-current={active === id ? 'page' : undefined}
              onClick={() => {setActive(id);setMenuOpen(false);setFocusBookingId(null);setOpenBookingId(null);}}
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
              <span>{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={onClose}>
            <ArrowUpRight size={16} /> View customer website
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-block admin-signout" onClick={onLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="studio-workspace-body"><header className="studio-topbar"><div><button className="icon-btn studio-menu-toggle" aria-label="Open navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}><Menu size={21}/></button><span className="studio-breadcrumb">Workspace <span>/</span> <strong>{NAV.find(t=>t.id===active)?.label}</strong></span></div><div className="studio-topbar-actions"><span className="studio-sync"><i/>{bookingsState==='error'?'Refresh needed':updated?`Updated ${updated.toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Manila'})}`:'Connecting…'}</span><button className="icon-btn" aria-label="Refresh data" disabled={refreshing} onClick={()=>void refresh()}><RefreshCw size={17} className={refreshing?'spin':''}/></button><span className="studio-role">{ROLE_LABELS[user.role]}</span><span className="avatar studio-topbar-avatar">{initials(user.fullName)}</span></div></header>
      <main className="admin-main" id="admin-main" tabIndex={-1}>
        {active === 'overview' && (
          <OverviewTab user={user} onNavigate={setActive} bookings={bookings} bookingsState={bookingsState} users={users} onOpenBooking={openBooking} onRefresh={loadBookings} />
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
            onOpenChange={setOpenBookingId}
          />
        )}
        {active === 'payments' && <PaymentsView bookings={bookings} onOpen={openBooking} state={bookingsState}/>}
        {active === 'customers' && <CustomersView bookings={bookings} onOpen={openBooking} state={bookingsState}/>}
        {active === 'activity' && <ActivityView onOpen={openBooking}/>}
        {active === 'inbox' && <InboxView/>}
        {active === 'users' && <UsersTab currentUser={user} users={users} state={usersState} onReload={loadUsers} />}
        {active === 'portfolio' && <PortfolioTab user={user} onChanged={onPortfolioUpdated} />}
        {active === 'availability' && <AvailabilityTab bookings={bookings} />}
        {active === 'reviews' && <TestimonialsTab />}
      </main><footer className="studio-workspace-footer"><span>Tutok Pitik Studios · Made for meaningful moments</span><span>Times shown in Manila · Bookings refresh every minute</span></footer></div>
    </div>
  );
}

// Page through all records rather than silently stopping at the API row limit.
async function loadAll(table: 'bookings'|'users') {
  const rows:any[]=[];
  for(let page=0;page<100;page++){
    const {data,error}=await supabase.from(table).select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*500,(page+1)*500-1);
    if(error)return {data:null,error};
    rows.push(...(data||[]));if(!data||data.length<500)return {data:rows,error:null};
  }
  return {data:null,error:new Error('The dataset is too large to load safely.')};
}
