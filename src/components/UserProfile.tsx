import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Ban, CalendarCheck, CalendarDays, Camera, Check, Download, ExternalLink, FileText, Heart, LoaderCircle, LogOut, MapPin, MessageCircle, Receipt, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import Modal from './common/Modal';
import ConfirmDialog from './common/ConfirmDialog';
import Picture from './common/Picture';
import { itemMatchesKey, type PortfolioItem } from '../content/portfolio';
import { STUDIO } from '../content/site';
import { normalizeBooking, paymentLabel, paymentTone, photoLabel, statusLabel, statusTone, type NormalizedBooking } from '../lib/bookings';
import { formatDateLong, formatPesoExact, initials } from '../lib/format';
import { AVATAR_BUCKET, publicUrl, resolveReceiptUrl, uploadToBucket } from '../lib/images';
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
}

const STEPS = ['Requested', 'Confirmed', 'Shoot day', 'Photos delivered'];

const progressIndex = (booking: NormalizedBooking) => {
  if (booking.status === 'completed') return booking.photoStatus === 'delivered' || booking.driveLink ? 3 : 2;
  if (booking.status === 'confirmed') return 1;
  return 0;
};

function BookingCard({ booking, onViewReceipt }: { booking: NormalizedBooking; onViewReceipt: (booking: NormalizedBooking) => void }) {
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
    <article className={`booking-card ${cancelled ? 'is-cancelled' : ''}`}>
      <header className="booking-card-head">
        <div>
          <h4>{booking.service}</h4>
          <span className="booking-ref">{booking.reference}</span>
        </div>
        <span className={`badge badge-${statusTone(booking.status)}`}>{statusLabel(booking.status)}</span>
      </header>

      {cancelled ? (
        <div className="notice notice-danger">
          <Ban size={18} aria-hidden="true" />
          <p>This booking was not approved{booking.paymentStatus === 'rejected' ? ' because the payment could not be verified' : ''}. Message us if you think this is a mistake, or submit a new booking.</p>
        </div>
      ) : (
        <ol className="tracker" aria-label="Booking progress">
          {STEPS.map((label, index) => (
            <li key={label} className={index < step ? 'is-done' : index === step ? 'is-current' : ''}>
              <span className="tracker-dot">{index < step ? <Check size={12} /> : null}</span>
              <span className="tracker-label">{label}</span>
            </li>
          ))}
        </ol>
      )}

      <dl className="booking-facts">
        <div>
          <dt><CalendarDays size={14} aria-hidden="true" /> Date</dt>
          <dd>{booking.dateDisplay}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{booking.time} · {booking.durationLabel}</dd>
        </div>
        <div className="span-2">
          <dt><MapPin size={14} aria-hidden="true" /> Location</dt>
          <dd>{booking.location || '—'}</dd>
        </div>
      </dl>

      <div className="booking-money">
        <div>
          <span>Total</span>
          <strong>{formatPesoExact(booking.totalAmount)}</strong>
          {booking.transportationFee > 0 && <small>incl. {formatPesoExact(booking.transportationFee)} transportation</small>}
        </div>
        <div>
          <span>Downpayment</span>
          <strong>{formatPesoExact(booking.downpaymentAmount)}</strong>
          <small className={`text-${paymentTone(booking.paymentStatus)}`}>{paymentLabel(booking.paymentStatus)}</small>
        </div>
        <div>
          <span>Due on shoot day</span>
          <strong>{formatPesoExact(booking.remainingBalance)}</strong>
        </div>
      </div>

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

      <footer className="booking-card-actions">
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
        <a className="btn btn-ghost btn-sm" href={STUDIO.socials.messenger} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={16} /> Ask about {booking.reference}
        </a>
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

export default function UserProfile({ isOpen, initialTab, user, catalog, onClose, onLogout, onUpdateUser, onBook, onOpenGallery }: UserProfileProps) {
  const isCustomer = user.role === 'customer';
  const [tab, setTab] = useState<ProfileTab>(initialTab || (isCustomer ? 'bookings' : 'account'));
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
    setTab(initialTab || (isCustomer ? 'bookings' : 'account'));
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
        setBookings([]);
        toast.error('Could not load your bookings', { description: error.message });
      } else {
        setBookings((data || []).map(normalizeBooking));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isCustomer, user.id]);

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
      onUpdateUser({ ...userFromProfile(data), profilePicture: data?.profile_picture_url || user.profilePicture });
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
      const url = path ? publicUrl(AVATAR_BUCKET, path) : dataUrl;
      const { error } = await supabase.from('users').update({ profile_picture_url: url, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
      onUpdateUser({ ...user, profilePicture: url });
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

  const tabs: { id: ProfileTab; label: string; icon: typeof Heart; count?: number }[] = isCustomer
    ? [
        { id: 'bookings', label: 'Bookings', icon: FileText, count: bookings?.length },
        { id: 'favorites', label: 'Favorites', icon: Heart, count: favoriteItems.length },
        { id: 'account', label: 'Account', icon: UserRound },
      ]
    : [{ id: 'account', label: 'Account', icon: UserRound }];

  return (
    <>
      <Modal open={isOpen} onClose={onClose} size="lg" className="profile-modal">
        <div className="profile-head">
          <div className="avatar avatar-lg">
            {user.profilePicture ? <img src={user.profilePicture} alt="" /> : <span>{initials(user.fullName)}</span>}
            <button type="button" className="avatar-edit" onClick={() => fileRef.current?.click()} aria-label="Change profile photo">
              <Camera size={14} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(event) => pickPhoto(event.target.files?.[0])} tabIndex={-1} />
          </div>
          <div>
            <h2>{user.fullName}</h2>
            <p>{user.username ? `@${user.username} · ` : ''}{user.email}</p>
          </div>
        </div>

        {tabs.length > 1 && (
          <div className="tabs" role="tablist" aria-label="Profile sections">
            {tabs.map((entry) => {
              const Icon = entry.icon;
              return (
                <button key={entry.id} type="button" role="tab" aria-selected={tab === entry.id} className={tab === entry.id ? 'is-active' : ''} onClick={() => setTab(entry.id)}>
                  <Icon size={16} aria-hidden="true" /> {entry.label}
                  {entry.count ? <span className="tab-count">{entry.count}</span> : null}
                </button>
              );
            })}
          </div>
        )}

        <div className="profile-body">
          {tab === 'bookings' && isCustomer && (
            <div className="stack">
              {bookings === null ? (
                <div className="loading-row"><LoaderCircle size={20} className="spin" /> Loading your bookings…</div>
              ) : bookings.length === 0 ? (
                <div className="empty-state">
                  <CalendarCheck size={40} aria-hidden="true" />
                  <h3>No bookings yet</h3>
                  <p>Pick a service and date. Your bookings, payment status and photo links will show up here.</p>
                  <button type="button" className="btn btn-primary" onClick={() => { onClose(); onBook(); }}>Book a session</button>
                </div>
              ) : (
                bookings.map((booking) => <BookingCard key={booking.id} booking={booking} onViewReceipt={viewReceipt} />)
              )}
            </div>
          )}

          {tab === 'favorites' && isCustomer && (
            favoriteItems.length === 0 ? (
              <div className="empty-state">
                <Heart size={40} aria-hidden="true" />
                <h3>No favorites yet</h3>
                <p>Open any portfolio photo and tap the heart to save looks you like. Share them with us when you book.</p>
              </div>
            ) : (
              <ul className="favorite-grid">
                {favoriteItems.map((item, index) => (
                  <li key={item.id}>
                    <button type="button" className="favorite-open" onClick={() => onOpenGallery(favoriteItems, index)} aria-label={`View ${item.title}`}>
                      <Picture item={item} alt={item.title} />
                    </button>
                    <div className="favorite-meta">
                      <span>{item.title}</span>
                      <button
                        type="button"
                        className="icon-btn icon-btn-sm"
                        aria-label={`Remove ${item.title} from favorites`}
                        onClick={() => {
                          favorites.filter((key) => itemMatchesKey(item, key)).forEach((key) => void remove(key));
                          toast.success('Removed from favorites');
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'account' && (
            <form className="account-form" onSubmit={saveAccount}>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="profile-first">First name</label>
                  <input id="profile-first" autoComplete="given-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="profile-last">Last name</label>
                  <input id="profile-last" autoComplete="family-name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="profile-phone">Mobile number</label>
                <input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                {isCustomer && !user.phone && <p className="field-hint">Needed for bookings so we can reach you on the day.</p>}
              </div>
              <div className="field">
                <label htmlFor="profile-email">Email</label>
                <input id="profile-email" type="email" value={user.email} readOnly disabled />
                <p className="field-hint">Contact us to change the email on your account.</p>
              </div>
              <dl className="meta-list">
                <div><dt>Member since</dt><dd>{user.joinDate ? formatDateLong(user.joinDate.slice(0, 10)) : '—'}</dd></div>
                {!isCustomer && <div><dt>Role</dt><dd className="capitalize">{user.role}</dd></div>}
              </dl>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setLogoutOpen(true)}>
                  <LogOut size={16} /> Sign out
                </button>
                <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
                  {saving && <LoaderCircle size={16} className="spin" />} Save changes
                </button>
              </div>
            </form>
          )}
        </div>
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
