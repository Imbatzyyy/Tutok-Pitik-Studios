import { OperationsOverview,OperationsBookings,OperationsClients,OperationsReports,OperationsNotifications,OperationsSchedule,OperationsSecurity,OperationsTeam } from './OperationsViews';
import { useStudioLive,confirmNavigation,hasUnsavedChanges } from '../../lib/studio';
import '../../styles/studio-operations.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarOff, ChartColumn, Images, LogOut, MessageSquareQuote, Users, X, Menu, ArrowUpRight, RefreshCw, Wallet, Activity, Inbox, UserRound, type LucideIcon } from 'lucide-react';
import { useModal } from '../../hooks/useModal';
import logo from '../../assets/logo-160.png';
import { ActivityView, InboxView } from './StudioViews';
import { initials } from '../../lib/format';
import type { SessionUser } from '../../lib/session';
import AvailabilityTab from './AvailabilityTab';
import ConfirmDialog from '../common/ConfirmDialog';
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
  { id: 'notifications', label: 'Notifications', icon: Inbox },
  { id: 'reports', label: 'Reports', icon: ChartColumn },
  { id: 'security', label: 'Security & health', icon: Activity },
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
  const [logoutOpen,setLogoutOpen]=useState(false);
  const [logoutHasChanges,setLogoutHasChanges]=useState(false);
  const menuRef=useModal<HTMLElement>(menuOpen,()=>setMenuOpen(false));
  useEffect(()=>{const resize=()=>{if(window.innerWidth>960)setMenuOpen(false);};window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  const [revision,setRevision]=useState(0);
  const [bookingView,setBookingView]=useState('');
  const refresh=useCallback(()=>setRevision(n=>n+1),[]);
  const live=useStudioLive(user.id,true,refresh);
  const openBooking=(id:string)=>{setFocusBookingId(id);setOpenBookingId(id);setActive('bookings');};
  const openView=(view:string)=>{setBookingView(view);setFocusBookingId(null);setOpenBookingId(null);setActive('bookings');};
  const pendingCount=0;

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
              onClick={() => {if(!confirmNavigation())return;setActive(id);setMenuOpen(false);setFocusBookingId(null);setOpenBookingId(null);}}
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
          <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={()=>{if(confirmNavigation())onClose();}}>
            <ArrowUpRight size={16} /> View customer website
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-block admin-signout" onClick={()=>{setLogoutHasChanges(hasUnsavedChanges());setLogoutOpen(true);}}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="studio-workspace-body"><header className="studio-topbar"><div><button className="icon-btn studio-menu-toggle" aria-label="Open navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}><Menu size={21}/></button><span className="studio-breadcrumb">Workspace <span>/</span> <strong>{NAV.find(t=>t.id===active)?.label}</strong></span></div><div className="studio-topbar-actions"><span className={`studio-sync ops-live-${live.toLowerCase()}`} role="status"><i/>{live}</span><button className="icon-btn" aria-label="Refresh data" onClick={refresh}><RefreshCw size={17}/></button><span className="studio-role">{ROLE_LABELS[user.role]}</span><span className="avatar studio-topbar-avatar">{initials(user.fullName)}</span></div></header>
      <main className="admin-main" id="admin-main" tabIndex={-1}>
        {active==='overview'&&<OperationsOverview user={user} revision={revision} onOpen={openBooking} onView={openView}/>}
        {(active==='bookings'||active==='payments')&&<OperationsBookings user={user} revision={revision} focusId={focusBookingId} initialView={active==='payments'?'payments':bookingView} onOpenChange={id=>{setOpenBookingId(id);if(!id)setFocusBookingId(null);}}/>}
        {active==='customers'&&<OperationsClients revision={revision} onOpen={openBooking}/>}
        {active==='reports'&&<OperationsReports revision={revision}/>}
        {active==='notifications'&&<OperationsNotifications revision={revision} admin={user.role!=='staff'} onOpen={openBooking}/>}
        {active==='security'&&<OperationsSecurity user={user} revision={revision}/>}
        {active==='users'&&<OperationsTeam user={user} revision={revision}/>}
        {active==='activity'&&<ActivityView key={revision} onOpen={openBooking}/>}
        {active==='inbox'&&<InboxView key={revision}/>}
        {active==='portfolio'&&<PortfolioTab user={user} onChanged={onPortfolioUpdated}/>}
        {active==='availability'&&<><OperationsSchedule revision={revision}/><AvailabilityTab bookings={[]}/></>}
        {active==='reviews'&&<TestimonialsTab/>}
      </main><footer className="studio-workspace-footer"><span>Tutok Pitik Studios · Made for meaningful moments</span><span>Times shown in Manila · Private live updates</span></footer></div>
      <ConfirmDialog
        open={logoutOpen}
        title="Sign out of the workspace?"
        message={logoutHasChanges
          ? 'You have unsaved changes. Signing out will discard them. You’ll need to sign in again to access your workspace.'
          : 'You’ll need to sign in again to access your studio workspace.'}
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        autoFocus="cancel"
        icon={<LogOut size={22} />}
        onCancel={()=>setLogoutOpen(false)}
        onConfirm={onLogout}
      />
    </div>
  );
}
