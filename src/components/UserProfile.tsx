import BookingWorkspace from './studio/BookingWorkspace';
import { useStudioLive, confirmNavigation, type LiveState } from '../lib/studio';
import '../styles/studio-operations.css';
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Ban, CalendarCheck, CalendarClock, Camera, Check, ChevronRight, Clock, Download, ExternalLink, FileText, Heart, Images, LoaderCircle, Lock, LogOut, MapPin, MessageCircle, Plus, Receipt, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import Modal from './common/Modal';
import ConfirmDialog from './common/ConfirmDialog';
import Picture from './common/Picture';
import { itemMatchesKey, type PortfolioItem } from '../content/portfolio';
import { STUDIO } from '../content/site';
import { normalizeBooking, paymentLabel, paymentTone, photoLabel, statusLabel, statusTone, type NormalizedBooking } from '../lib/bookings';
import { formatDateLong, formatPesoExact, initials, parseDateKey, toDateKey } from '../lib/format';
import { AVATAR_BUCKET, resolveAvatarUrl, resolveReceiptUrl, uploadToBucket } from '../lib/images';
import { errorMessage, notify } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useFavorites } from '../lib/useFavorites';
import { userFromProfile, type SessionUser } from '../lib/session';

export type ProfileTab = 'bookings' | 'favorites' | 'account';

interface UserProfileProps {
  isOpen: boolean;
  initialTab?: ProfileTab;
  user: SessionUser;
  catalog: PortfolioItem[];
  onClose: () => void;
  onLogout: () => void;
  onUpdateUser: (user: SessionUser) => void;
  onBook: () => void;
  onOpenGallery: (items: PortfolioItem[], index: number) => void;
  /** Closes the profile and scrolls to the portfolio (offered when there are no favorites yet). */
  onBrowsePortfolio?: () => void;
  /** Keeps /account/<tab> in the address bar in step with the open tab. */
  onTabChange?: (tab: ProfileTab) => void;
}

const STEPS = ['Requested', 'Confirmed', 'Shoot day', 'Photos delivered'];

const progressIndex = (booking: NormalizedBooking) => {
  if (booking.status === 'completed') return booking.photoStatus === 'delivered' ? 3 : 2;
  if (booking.status === 'confirmed') return 1;
  return 0;
};

const isDateKey = (value?: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}/.test(value));

/** Whole days from today to a booking date; negative once it has passed. */
const daysUntil = (dateKey: string) => {
  const today = parseDateKey(toDateKey(new Date()));
  return Math.round((parseDateKey(dateKey.slice(0, 10)).getTime() - today.getTime()) / 86_400_000);
};

const shortDay = (dateKey: string) =>
  parseDateKey(dateKey.slice(0, 10)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const whenLabel = (days: number) => (days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`);

/** Still ahead of the customer: pending or confirmed, and not dated in the past. */
const isUpcoming = (booking: NormalizedBooking) =>
  (booking.status === 'pending' || booking.status === 'confirmed') && (!isDateKey(booking.date) || daysUntil(booking.date) >= 0);

function LiveStatus({ state }: { state: LiveState }) {
  return (
    <p className={`pf-live is-${state.toLowerCase()}`} role="status">
      <span className="pf-live-dot" aria-hidden="true" />
      Booking updates: {state}
    </p>
  );
}

function DateTile({ dateKey }: { dateKey: string }) {
  if (!isDateKey(dateKey)) {
    return (
      <div className="bk-date is-empty" aria-hidden="true">
        <CalendarClock size={22} />
      </div>
    );
  }
  const date = parseDateKey(dateKey.slice(0, 10));
  return (
    <div className="bk-date" aria-hidden="true">
      <span className="bk-date-day">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
      <strong>{date.getDate()}</strong>
      <span className="bk-date-month">{date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
    </div>
  );
}

function BookingCard({ booking, onViewReceipt, onManage }: { booking: NormalizedBooking; onViewReceipt: (booking: NormalizedBooking) => void; onManage: (id: string) => void }) {
  const [downloading, setDownloading] = useState(false);
  const step = progressIndex(booking);
  const cancelled = booking.status === 'cancelled';
  const hasReceipt = Boolean(booking.paymentReceiptUrl || booking.paymentReceiptPath);

  const download = async () => {
    setDownloading(true);
    try {
      const { downloadBookingReceipt } = await import('../lib/pdf');
      await downloadBookingReceipt(booking);
    } catch (error) {
      toast.error('Could not create the PDF', { description: errorMessage(error) });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className={`bk-card is-${booking.status}`}>
      <header className="bk-head">
        <DateTile dateKey={booking.date} />
        <div className="bk-title">
          <div className="bk-title-row">
            <h5>{booking.service}</h5>
            <span className={`badge badge-${statusTone(booking.status)}`}>{statusLabel(booking.status)}</span>
          </div>
          <p className="sr-only">{booking.dateDisplay}</p>
          <ul className="bk-meta">
            <li><Clock size={15} aria-hidden="true" /> {booking.time} · {booking.durationLabel}</li>
            <li><MapPin size={15} aria-hidden="true" /> {booking.location || '—'}</li>
          </ul>
          <span className="bk-ref">{booking.reference}</span>
        </div>
      </header>

      {cancelled ? (
        <div className="notice notice-danger">
          <Ban size={18} aria-hidden="true" />
          <p>This booking was cancelled. Your payment and refund status are shown below. Contact the studio with your reference if you need help.</p>
        </div>
      ) : (
        <ol className="bk-steps" aria-label="Booking progress">
          {STEPS.map((label, index) => (
            <li key={label} className={index < step ? 'is-done' : index === step ? 'is-current' : ''} aria-current={index === step ? 'step' : undefined}>
              <span className="bk-step-bar" aria-hidden="true" />
              <span className="bk-step-label">
                {index < step ? <Check size={13} aria-hidden="true" /> : null}
                {label}
              </span>
            </li>
          ))}
        </ol>
      )}

      <dl className="bk-money">
        <div>
          <dt>Total</dt>
          <dd>{formatPesoExact(booking.totalAmount)}</dd>
          {booking.transportationFee > 0 && <dd className="bk-money-sub">incl. {formatPesoExact(booking.transportationFee)} transportation</dd>}
        </div>
        <div>
          <dt>Requested deposit</dt>
          <dd>{formatPesoExact(booking.downpaymentAmount)}</dd>
          <dd className={`bk-money-sub bk-pay text-${paymentTone(booking.paymentStatus)}`}>{paymentLabel(booking.paymentStatus)}</dd>
        </div>
        <div>
          <dt>Verified payments</dt><dd>{formatPesoExact(booking.raw.paid_amount ?? (booking.paymentStatus === 'verified' ? booking.downpaymentAmount : 0))}</dd>
        </div>
        {Number(booking.raw.refunded_amount) > 0 && <div><dt>Refunded</dt><dd>{formatPesoExact(booking.raw.refunded_amount)}</dd></div>}
        <div>
          <dt>{cancelled ? 'Session cancelled' : booking.paymentStatus === 'submitted' ? 'Balance if deposit is verified' : 'Remaining balance'}</dt>
          <dd>{cancelled ? 'No shoot scheduled' : formatPesoExact(booking.paymentStatus === 'submitted' && !Number(booking.raw.paid_amount) ? Math.max(0,booking.totalAmount - booking.downpaymentAmount) : booking.remainingBalance)}</dd>
        </div>
      </dl>

      {booking.adminNote && (
        <div className="studio-note">
          <MessageCircle size={16} />
          <div>
            <span className="field-label">Note from the studio</span>
            <p>{booking.adminNote}</p>
          </div>
        </div>
      )}

      {(booking.status === 'completed' || (booking.driveLink && booking.status !== 'cancelled')) && (
        <div className="delivery-box">
          <div>
            <span className="field-label">Photos</span>
            <strong>{photoLabel(booking.photoStatus)}</strong>
          </div>
          {booking.driveLink ? (
            <a className="btn btn-primary btn-sm" href={booking.driveLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} /> Open photo folder
            </a>
          ) : (
            <span className="field-hint">Your Google Drive link will appear here when your photos are ready.</span>
          )}
        </div>
      )}

      {booking.photoStatus === 'delivered' && <p><a href={'mailto:'+STUDIO.email+'?subject='+encodeURIComponent('Optional feedback · '+booking.reference)}>Share feedback about your session</a> · We will ask your permission before publishing a review.</p>}
      <footer className="bk-actions">
        <button type="button" className="btn btn-sm bk-manage" onClick={() => onManage(booking.id)}>
          Manage booking <ChevronRight size={16} aria-hidden="true" />
        </button>
        <div className="bk-actions-secondary">
          {hasReceipt && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onViewReceipt(booking)}>
              <Receipt size={16} /> Payment receipt
            </button>
          )}
          {booking.status === 'completed' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={download} disabled={downloading}>
              {downloading ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />} Official receipt (PDF)
            </button>
          )}
          <a className="btn btn-ghost btn-sm" href={STUDIO.socials.messenger} target="_blank" rel="noopener noreferrer" aria-label={`Ask on Messenger about ${booking.reference}`}>
            <MessageCircle size={16} /> Ask on Messenger
          </a>
        </div>
      </footer>
    </article>
  );
}

const CROP_VIEW = 280;
const CROP_OUT = 400;

function AvatarCropper({ source, onCancel, onSave }: { source: string; onCancel: () => void; onSave: (blob: Blob, dataUrl: string) => Promise<void> }) {
  const [natural, setNatural] = useState({ width: CROP_VIEW, height: CROP_VIEW });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const scale = Math.max(CROP_VIEW / image.width, CROP_VIEW / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      setNatural({ width, height });
      setPos({ x: (CROP_VIEW - width) / 2, y: (CROP_VIEW - height) / 2 });
    };
    image.src = source;
  }, [source]);

  const clamp = (x: number, y: number, z = zoom) => {
    const width = natural.width * z;
    const height = natural.height * z;
    return { x: Math.min(0, Math.max(CROP_VIEW - width, x)), y: Math.min(0, Math.max(CROP_VIEW - height, y)) };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, ox: pos.x, oy: pos.y };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos(clamp(drag.current.ox + event.clientX - drag.current.x, drag.current.oy + event.clientY - drag.current.y));
  };

  const save = async () => {
    if (!imageRef.current) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CROP_OUT;
      canvas.height = CROP_OUT;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image editing is not supported in this browser.');
      const ratio = CROP_OUT / CROP_VIEW;
      context.fillStyle = '#111';
      context.fillRect(0, 0, CROP_OUT, CROP_OUT);
      context.drawImage(imageRef.current, pos.x * ratio, pos.y * ratio, natural.width * zoom * ratio, natural.height * zoom * ratio);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Could not process image.'))), 'image/jpeg', 0.86));
      await onSave(blob, dataUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onCancel}
      dismissible={!busy}
      size="sm"
      title="Position your photo"
      description="Drag to frame your face, then use the slider to zoom."
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy} data-autofocus>
            {busy && <LoaderCircle size={16} className="spin" />} Save photo
          </button>
        </>
      }
    >
      <div className="cropper" style={{ width: CROP_VIEW, height: CROP_VIEW }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
        <img src={source} alt="" draggable={false} style={{ width: natural.width * zoom, height: natural.height * zoom, transform: `translate(${pos.x}px, ${pos.y}px)` }} />
        <span className="cropper-ring" aria-hidden="true" />
      </div>
      <label className="range-field">
        <span>Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(event) => {
            const value = Number(event.target.value);
            setZoom(value);
            setPos((current) => clamp(current.x, current.y, value));
          }}
        />
      </label>
    </Modal>
  );
}

export default function UserProfile({ isOpen, initialTab, user, catalog, onClose, onLogout, onUpdateUser, onBook, onOpenGallery, onBrowsePortfolio, onTabChange }: UserProfileProps) {
  const isCustomer = user.role === 'customer';
  // Team accounts only have the Account tab.
  const startTab: ProfileTab = isCustomer ? initialTab || 'bookings' : 'account';
  const [tab, setTab] = useState<ProfileTab>(startTab);

  useEffect(() => {
    if (isOpen) onTabChange?.(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab]);
  const [bookingRevision, setBookingRevision] = useState(0);
  const [openBooking, setOpenBooking] = useState<string | null>(() => {
    const value=new URLSearchParams(location.search).get('booking');
    return value && /^[a-f0-9-]{36}$/i.test(value) ? value : null;
  });
  const live = useStudioLive(user.id, false, () => setBookingRevision((n) => n + 1), isOpen && isCustomer);
  const [bookingsError,setBookingsError] = useState(false);
  const [bookings, setBookings] = useState<NormalizedBooking[] | null>(null);
  const [receipt, setReceipt] = useState<{ url: string; name: string } | null>(null);
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, phone: user.phone });
  const [saving, setSaving] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { favorites, remove } = useFavorites(user);

  useEffect(() => {
    if (!isOpen) return;
    setTab(startTab);
    setForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || !isCustomer) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('bookings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        setBookingsError(true);
      } else {
        setBookingsError(false);
        setBookings((data || []).map(normalizeBooking));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isCustomer, user.id, bookingRevision]);

  const favoriteItems = useMemo(() => {
    const seen = new Set<string>();
    return favorites
      .map((key) => catalog.find((item) => itemMatchesKey(item, key)))
      .filter((item): item is PortfolioItem => {
        if (!item || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [favorites, catalog]);

  const dirty = form.firstName.trim() !== user.firstName || form.lastName.trim() !== user.lastName || form.phone.trim() !== (user.phone || '');

  const saveAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (form.phone.trim() && form.phone.replace(/\D/g, '').length < 10) {
      toast.error('Enter a full mobile number');
      return;
    }
    setSaving(true);
    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      const { data, error } = await supabase
        .from('users')
        .update({ full_name: fullName, phone: form.phone.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('*')
        .single();
      if (error) throw error;
      // Keep auth metadata in sync for name/phone only. Roles are never written from the browser.
      void supabase.auth.updateUser({ data: { full_name: fullName, phone: form.phone.trim() } }).catch(() => undefined);
      onUpdateUser({ ...userFromProfile(data), profilePicture: user.profilePicture });
      void notify('/send-profile-update-email', { fullName, updatedFields: ['Full Name', 'Mobile Number'] });
      toast.success('Account details saved');
    } catch (error) {
      toast.error('Could not save your details', { description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Please choose an image under 15 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSource(reader.result as string);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const savePhoto = async (blob: Blob, dataUrl: string) => {
    try {
      const path = await uploadToBucket(AVATAR_BUCKET, `${user.id}/avatar-${Date.now()}.jpg`, blob);
      const url = path || dataUrl;
      const { error } = await supabase.from('users').update({ profile_picture_url: url, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
      onUpdateUser({ ...user, profilePicture: await resolveAvatarUrl(url) });
      setCropSource(null);
      toast.success('Profile photo updated');
    } catch (error) {
      toast.error('Could not update your photo', { description: errorMessage(error) });
    }
  };

  const viewReceipt = async (booking: NormalizedBooking) => {
    const url = await resolveReceiptUrl(booking);
    if (url) setReceipt({ url, name: booking.paymentReceiptName || 'Payment receipt' });
    else toast.error('Receipt is not available right now');
  };

  // Upcoming shoots soonest first; everything else (done, cancelled or dated in the past) newest first.
  const upcoming = useMemo(
    () => (bookings || []).filter(isUpcoming).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    [bookings]
  );
  const past = useMemo(() => (bookings || []).filter((booking) => !isUpcoming(booking)).sort((a, b) => b.date.localeCompare(a.date)), [bookings]);
  const completedCount = (bookings || []).filter((booking) => booking.status === 'completed').length;
  const nextShoot = upcoming.find((booking) => booking.status === 'confirmed' && isDateKey(booking.date)) || upcoming.find((booking) => isDateKey(booking.date));
  const memberYear = user.joinDate ? user.joinDate.slice(0, 4) : '';
  const panelRef = useRef<HTMLDivElement>(null);

  // Opening a booking swaps the list for its workspace, so bring the top of it into view.
  useEffect(() => {
    if (openBooking) panelRef.current?.scrollIntoView({ block: 'start' });
  }, [openBooking]);

  const selectTab = (next: ProfileTab) => {
    void confirmNavigation().then((ok) => {
      if (ok) setTab(next);
    });
  };

  const manageBooking = (id: string) => {
    void confirmNavigation().then((ok) => {
      if (!ok) return;
      setTab('bookings');
      setOpenBooking(id);
    });
  };

  const startBooking = () => {
    onClose();
    onBook();
  };

  const tabs: { id: ProfileTab; label: string; icon: typeof Heart; count?: number }[] = isCustomer
    ? [
        { id: 'bookings', label: 'Bookings', icon: FileText, count: bookings?.length },
        { id: 'favorites', label: 'Favorites', icon: Heart, count: favoriteItems.length },
        { id: 'account', label: 'Account', icon: UserRound },
      ]
    : [{ id: 'account', label: 'Account', icon: UserRound }];

  const renderCards = (list: NormalizedBooking[]) =>
    list.map((booking) => <BookingCard key={booking.id} booking={booking} onViewReceipt={viewReceipt} onManage={setOpenBooking} />);

  return (
    <>
      <Modal
        open={isOpen}
        onClose={() => {
          void confirmNavigation().then((ok) => {
            if (ok) onClose();
          });
        }}
        size="lg"
        className="profile-modal"
      >
        <section className="pf-hero" aria-label="Your profile">
          <div className="pf-cover" aria-hidden="true" />
          <div className="pf-identity">
            <div className="avatar pf-avatar">
              {user.profilePicture ? <img src={user.profilePicture} alt="" /> : <span>{initials(user.fullName)}</span>}
              <button type="button" className="pf-avatar-edit" onClick={() => fileRef.current?.click()} aria-label="Change profile photo">
                <Camera size={15} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(event) => pickPhoto(event.target.files?.[0])} tabIndex={-1} />
            </div>
            <div className="pf-name">
              <span className="pf-chip">{isCustomer ? 'Client account' : 'Studio team'}</span>
              <h2>{user.fullName}</h2>
              <p>{user.username ? `@${user.username} · ` : ''}{user.email}</p>
            </div>
          </div>

          {isCustomer && (
            <div className={`pf-summary ${nextShoot ? 'has-next' : ''}`}>
              <ul className="pf-stats" aria-label="Your bookings at a glance">
                <li><strong>{bookings ? upcoming.length : '–'}</strong><span>Upcoming</span></li>
                <li><strong>{bookings ? completedCount : '–'}</strong><span>Completed</span></li>
                <li><strong>{memberYear || '—'}</strong><span>Joined</span></li>
              </ul>
              {nextShoot && (
                <button type="button" className="pf-next" onClick={() => manageBooking(nextShoot.id)}>
                  <span className="pf-next-icon" aria-hidden="true"><CalendarClock size={20} /></span>
                  <span className="pf-next-text">
                    <span className="pf-next-label">
                      {nextShoot.status === 'confirmed' ? 'Next shoot' : 'Requested shoot'} · {whenLabel(daysUntil(nextShoot.date))}
                    </span>
                    <strong>{nextShoot.service}</strong>
                    <span className="pf-next-when">
                      <span>{shortDay(nextShoot.date)}</span> · <span>{nextShoot.time}</span>
                    </span>
                  </span>
                  <ChevronRight className="pf-next-go" size={20} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </section>

        <div ref={panelRef} className="pf-anchor" />

        {tabs.length > 1 && (
          <div className="pf-tabs-wrap">
            <div className="tabs pf-tabs" role="tablist" aria-label="Profile sections">
              {tabs.map((entry) => {
                const Icon = entry.icon;
                return (
                  <button key={entry.id} type="button" role="tab" aria-selected={tab === entry.id} className={tab === entry.id ? 'is-active' : ''} onClick={() => selectTab(entry.id)}>
                    <Icon size={16} aria-hidden="true" /> {entry.label}
                    {entry.count ? <span className="tab-count">{entry.count}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'bookings' && isCustomer && (
          <div className="pf-panel">
            {bookingsError && <div className="notice" role="alert">We could not refresh your bookings. {bookings?.length ? 'Showing the last available information.' : ''} <button type="button" className="btn-link" onClick={() => setBookingRevision(n => n+1)}>Retry</button></div>}
            {bookingsError && !bookings?.length ? null : bookings === null ? (
              <div className="loading-row"><LoaderCircle size={20} className="spin" /> Loading your bookings…</div>
            ) : bookings.length === 0 ? (
              <div className="empty-state pf-empty">
                <span className="pf-empty-icon" aria-hidden="true"><CalendarCheck size={28} /></span>
                <h3>No bookings yet</h3>
                <p>Pick a service and date. Your bookings, payment status and photo links will show up here.</p>
                <button type="button" className="btn btn-primary" onClick={startBooking}>Book a session</button>
              </div>
            ) : openBooking ? (
              <>
                <LiveStatus state={live} />
                <BookingWorkspace id={openBooking} user={user} revision={bookingRevision} onClose={() => setOpenBooking(null)} onChanged={() => setBookingRevision((n) => n + 1)} />
              </>
            ) : (
              <>
                <div className="pf-section-head">
                  <div className="pf-section-title">
                    <h3>Your bookings</h3>
                    <button type="button" className="btn btn-outline btn-sm" onClick={startBooking}>
                      <Plus size={16} aria-hidden="true" /> New booking
                    </button>
                  </div>
                  <p>Open a booking to message the studio or request changes.</p>
                  <LiveStatus state={live} />
                </div>

                <section className="pf-group" aria-labelledby="pf-upcoming">
                  <h4 id="pf-upcoming" className="pf-group-title">Upcoming <span>{upcoming.length}</span></h4>
                  {upcoming.length ? (
                    renderCards(upcoming)
                  ) : (
                    <div className="pf-inline-empty">
                      <span>No upcoming shoots right now.</span>
                      <button type="button" className="btn-link" onClick={startBooking}>Book a session</button>
                    </div>
                  )}
                </section>

                {past.length > 0 && (
                  <section className="pf-group" aria-labelledby="pf-past">
                    <h4 id="pf-past" className="pf-group-title">Past &amp; cancelled <span>{past.length}</span></h4>
                    {renderCards(past)}
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'favorites' && isCustomer && (
          <div className="pf-panel">
            {favoriteItems.length === 0 ? (
              <div className="empty-state pf-empty">
                <span className="pf-empty-icon" aria-hidden="true"><Heart size={28} /></span>
                <h3>No favorites yet</h3>
                <p>Open any portfolio photo and tap the heart to save looks you like. Share them with us when you book.</p>
                {onBrowsePortfolio && (
                  <button type="button" className="btn btn-outline" onClick={onBrowsePortfolio}>
                    <Images size={18} aria-hidden="true" /> Browse the portfolio
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="pf-section-head">
                  <h3>Saved looks</h3>
                  <p>Photos you liked. Share them with us when you book.</p>
                </div>
                <ul className="pf-favs">
                  {favoriteItems.map((item, index) => (
                    <li key={item.id} className="pf-fav">
                      <button type="button" className="pf-fav-open" onClick={() => onOpenGallery(favoriteItems, index)} aria-label={`View ${item.title}`}>
                        <Picture item={item} alt={item.title} />
                        <span className="pf-fav-caption" aria-hidden="true">
                          <strong>{item.title}</strong>
                          {item.description && <span>{item.description}</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="pf-fav-remove"
                        aria-label={`Remove ${item.title} from favorites`}
                        onClick={() => {
                          favorites.filter((key) => itemMatchesKey(item, key)).forEach((key) => void remove(key));
                          toast.success('Removed from favorites');
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {tab === 'account' && (
          <div className="pf-panel pf-account">
            <form className="account-form pf-card" onSubmit={saveAccount}>
              <header className="pf-card-head">
                <span className="pf-card-icon" aria-hidden="true"><UserRound size={18} /></span>
                <div>
                  <h3>Personal details</h3>
                  <p>Your name and the number we can reach you on.</p>
                </div>
              </header>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="profile-first">First name</label>
                  <input id="profile-first" type="text" autoComplete="given-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="profile-last">Last name</label>
                  <input id="profile-last" type="text" autoComplete="family-name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="profile-phone">Mobile number</label>
                <input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                {isCustomer && !user.phone && <p className="field-hint">Needed for bookings so we can reach you on the day.</p>}
              </div>
              <div className="pf-card-foot">
                {dirty && <span className="pf-save-hint">Unsaved changes</span>}
                <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
                  {saving && <LoaderCircle size={16} className="spin" />} Save changes
                </button>
              </div>
            </form>

            <div className="pf-side">
              <section className="pf-card" aria-labelledby="pf-signin-title">
                <header className="pf-card-head">
                  <span className="pf-card-icon" aria-hidden="true"><Lock size={18} /></span>
                  <div>
                    <h3 id="pf-signin-title">Sign-in email</h3>
                    <p>Contact us to change the email on your account.</p>
                  </div>
                </header>
                <div className="field">
                  <label htmlFor="profile-email" className="sr-only">Email</label>
                  <input id="profile-email" type="email" value={user.email} readOnly disabled />
                </div>
                <dl className="meta-list pf-meta">
                  <div><dt>Member since</dt><dd>{user.joinDate ? formatDateLong(user.joinDate.slice(0, 10)) : '—'}</dd></div>
                  {!isCustomer && <div><dt>Role</dt><dd className="capitalize">{user.role}</dd></div>}
                </dl>
              </section>

              <section className="pf-card" aria-labelledby="pf-signout-title">
                <header className="pf-card-head">
                  <span className="pf-card-icon" aria-hidden="true"><LogOut size={18} /></span>
                  <div>
                    <h3 id="pf-signout-title">Sign out</h3>
                    <p>Sign out on this device. You can sign back in any time.</p>
                  </div>
                </header>
                <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setLogoutOpen(true)}>
                  <LogOut size={16} /> Sign out
                </button>
              </section>
            </div>
          </div>
        )}
      </Modal>

      {cropSource && <AvatarCropper source={cropSource} onCancel={() => setCropSource(null)} onSave={savePhoto} />}

      <Modal open={Boolean(receipt)} onClose={() => setReceipt(null)} size="md" title="Payment receipt" description={receipt?.name}>
        {receipt && <img src={receipt.url} alt={receipt.name} className="receipt-full" />}
      </Modal>

      <ConfirmDialog
        open={logoutOpen}
        title="Sign out?"
        message="You can sign back in any time to see your bookings."
        confirmLabel="Sign out"
        tone="danger"
        icon={<LogOut size={22} />}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          onLogout();
        }}
      />
    </>
  );
}
