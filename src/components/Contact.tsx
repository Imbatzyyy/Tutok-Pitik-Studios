import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CalendarCheck, Check, ImageUp, Info, LoaderCircle, Lock, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import BookingCalendar from './BookingCalendar';
import ConfirmDialog from './common/ConfirmDialog';
import Modal from './common/Modal';
import { SERVICE_ICONS } from './Services';
import { DOWNPAYMENT_RATE, MAX_ACTIVE_BOOKINGS, SERVICES, STUDIO, findService } from '../content/site';
import { freeEndHours, freeStartHours, hourToTime, isRangeFree, timeToHour, type AvailabilityState } from '../lib/availability';
import { ACTIVE_STATUSES, bookingReference, buildBookingMessage } from '../lib/bookings';
import { escapeHtml, formatDateLong, formatPeso, formatPesoExact, formatTime, hoursLabel } from '../lib/format';
import { compressImage, randomId, RECEIPTS_BUCKET, uploadToBucket } from '../lib/images';
import { errorMessage, isMissingRelation, notify } from '../lib/api';
import { supabase } from '../lib/supabase';

export interface BookingPrefill {
  serviceId?: string;
  hours?: number;
  nonce: number;
}

export interface BookingSuccess {
  reference: string;
  service: string;
  date: string;
  dateDisplay: string;
  startTime: string;
  endTime: string;
  time: string;
  hours: number;
  total: number;
  downpayment: number;
  balance: number;
  location: string;
  email: string;
}

interface ContactProps {
  user: any;
  availability: AvailabilityState;
  prefill?: BookingPrefill | null;
  onSuccess: (booking: BookingSuccess) => void;
  onRequireAuth: (view: 'signin' | 'signup') => void;
  onUserUpdated: (user: any) => void;
}

interface Draft {
  serviceId: string;
  date: string | null;
  start: number | null;
  hours: number | null;
  location: string;
  notes: string;
  phone: string;
}

const DRAFT_KEY = 'tps:booking-draft';
const EMPTY_DRAFT: Draft = { serviceId: '', date: null, start: null, hours: null, location: '', notes: '', phone: '' };

const loadDraft = (): Draft => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
};

const phoneLooksValid = (value: string) => value.replace(/\D/g, '').length >= 10;

export default function Contact({ user, availability, prefill, onSuccess, onRequireAuth, onUserUpdated }: ContactProps) {
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<{ blob: Blob; dataUrl: string; name: string } | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const isGuest = !user || user.role === 'guest';
  const isCustomer = user?.role === 'customer';
  const isTeam = user && ['superadmin', 'admin', 'staff'].includes(user.role);
  const accountPhone = (user?.phone || '').trim();
  const needsPhone = isCustomer && !accountPhone;

  const service = findService(draft.serviceId);
  const daySlots = draft.date ? availability.slots[draft.date] : undefined;
  const startOptions = useMemo(() => freeStartHours(daySlots), [daySlots]);
  const hourOptions = useMemo(() => (draft.start === null ? [] : freeEndHours(draft.start, daySlots).map((end) => end - (draft.start as number))), [draft.start, daySlots]);
  const hours = draft.hours && hourOptions.includes(draft.hours) ? draft.hours : null;
  const endHour = draft.start !== null && hours ? draft.start + hours : null;
  const total = service && hours ? service.rate * hours : 0;
  const downpayment = total * DOWNPAYMENT_RATE;
  const ready = Boolean(service && draft.date && draft.start !== null && hours);

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage blocked: draft only lives in memory */
    }
  }, [draft]);

  // Service / package buttons elsewhere on the page prefill the form.
  useEffect(() => {
    if (!prefill) return;
    setDraft((current) => ({
      ...current,
      serviceId: prefill.serviceId || current.serviceId,
      hours: prefill.hours || current.hours,
    }));
  }, [prefill]);

  // If the chosen start time stops being free (fresh availability), clear it.
  useEffect(() => {
    if (draft.start !== null && draft.date && !startOptions.includes(draft.start)) {
      setDraft((current) => ({ ...current, start: null }));
    }
  }, [startOptions, draft.start, draft.date]);

  const handleReceipt = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, receipt: 'Please upload a screenshot or photo (JPG or PNG).' }));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErrors((current) => ({ ...current, receipt: 'That file is over 15 MB. Please upload a smaller screenshot.' }));
      return;
    }
    setReceiptBusy(true);
    try {
      const compressed = await compressImage(file, 1600, 0.8);
      setReceipt({ blob: compressed.blob, dataUrl: compressed.dataUrl, name: file.name });
      setErrors((current) => ({ ...current, receipt: '' }));
    } catch (error) {
      setErrors((current) => ({ ...current, receipt: errorMessage(error, 'We could not read that image.') }));
    } finally {
      setReceiptBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!service) next.serviceId = 'Choose a service.';
    if (!draft.date) next.date = 'Pick a date.';
    if (draft.start === null) next.start = 'Pick a start time.';
    else if (!hours) next.hours = 'Choose how many hours you need.';
    if (draft.location.trim().length < 8) next.location = 'Enter the full address of the shoot location.';
    if (needsPhone && !phoneLooksValid(draft.phone)) next.phone = 'Enter a mobile number we can reach you on (e.g. 0917 123 4567).';
    if (!isGuest) {
      if (reference.trim().length < 6) next.reference = 'Enter the GCash reference number from your receipt.';
      if (!receipt) next.receipt = 'Upload your GCash receipt screenshot.';
    }
    setErrors(next);
    const firstKey = Object.keys(next)[0];
    if (firstKey) {
      const field = sectionRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true });
    }
    return !firstKey;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isTeam) {
      toast.info('Bookings are for customer accounts', { description: 'Studio team accounts can manage bookings from the Admin dashboard.' });
      return;
    }
    if (!validate()) return;
    if (isGuest) {
      setAuthPromptOpen(true);
      return;
    }

    try {
      const { data, error } = await supabase.from('bookings').select('id, status').eq('user_id', user.id).in('status', ACTIVE_STATUSES);
      if (!error && (data || []).length >= MAX_ACTIVE_BOOKINGS) {
        toast.warning('You already have the maximum active bookings', {
          description: `You can have up to ${MAX_ACTIVE_BOOKINGS} pending or confirmed bookings at a time. Message us if you need more.`,
        });
        return;
      }
    } catch {
      /* the database enforces nothing here; allow submit if the check fails */
    }
    setConfirmOpen(true);
  };

  const submitBooking = async () => {
    if (submittingRef.current || !service || !draft.date || draft.start === null || !hours || !receipt) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please sign in again.');

      const startTime = hourToTime(draft.start);
      const endTime = hourToTime(draft.start + hours);

      // Fresh conflict check, in case someone booked the slot a moment ago.
      const { data: slots, error: slotError } = await supabase.rpc('get_booked_slots', { start_date: draft.date, end_date: draft.date });
      if (!slotError && slots) {
        const taken = (slots as any[]).map((slot) => ({ date: draft.date as string, start: timeToHour(slot.start_time), end: timeToHour(slot.end_time) }));
        if (!isRangeFree(draft.start, draft.start + hours, taken)) {
          availability.reload();
          throw new Error('Sorry, that time was just booked. Please choose another time.');
        }
      } else if (slotError && !isMissingRelation(slotError)) {
        console.warn('Slot check failed:', slotError.message);
      }

      let phone = accountPhone;
      if (needsPhone) {
        phone = draft.phone.trim();
        const { error } = await supabase.from('users').update({ phone, updated_at: new Date().toISOString() }).eq('id', user.id);
        if (error) console.warn('Could not save phone to profile:', error.message);
        else onUserUpdated({ ...user, phone });
      }

      const receiptPath = await uploadToBucket(RECEIPTS_BUCKET, `${user.id}/${randomId()}.jpg`, receipt.blob);
      const message = buildBookingMessage(draft.notes, {
        paymentMethod: 'GCash',
        paymentReference: reference.trim(),
        paymentReceiptPath: receiptPath || undefined,
        paymentReceiptUrl: receiptPath ? undefined : receipt.dataUrl,
        paymentReceiptName: receipt.name,
        paymentStatus: 'submitted',
        paymentSubmittedAt: new Date().toISOString(),
        downpaymentAmount: downpayment,
      });

      const row = {
        user_id: session.user.id,
        full_name: user.fullName,
        email: user.email,
        phone,
        service: service.title,
        booking_date: draft.date,
        start_time: startTime,
        end_time: endTime,
        duration: hours,
        price: service.rate,
        transportation_fee: 0,
        total_price: total,
        location: draft.location.trim(),
        message,
        status: 'pending',
      };

      const { data: booking, error } = await supabase.from('bookings').insert(row).select('*').single();
      if (error || !booking) throw new Error(error?.message || 'We could not save your booking.');

      void notify('/send-booking-email', { booking: { ...row, id: booking.id, message: escapeHtml(draft.notes.trim()) } });

      const success: BookingSuccess = {
        reference: bookingReference(booking),
        service: service.title,
        date: draft.date,
        dateDisplay: formatDateLong(draft.date),
        startTime,
        endTime,
        time: `${formatTime(startTime)} – ${formatTime(endTime)}`,
        hours,
        total,
        downpayment,
        balance: total - downpayment,
        location: row.location,
        email: user.email,
      };

      setConfirmOpen(false);
      setDraft(EMPTY_DRAFT);
      setReference('');
      setReceipt(null);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      availability.reload();
      onSuccess(success);
    } catch (error) {
      toast.error('Booking not submitted', { description: errorMessage(error) });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const summary = (
    <div className="summary-card">
      <h3>Booking summary</h3>
      <dl>
        <div>
          <dt>Service</dt>
          <dd>{service?.title || '—'}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{draft.date ? formatDateLong(draft.date) : '—'}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{draft.start !== null && endHour ? `${formatTime(hourToTime(draft.start))} – ${formatTime(hourToTime(endHour))}` : '—'}</dd>
        </div>
        <div>
          <dt>Rate</dt>
          <dd>{service ? `${formatPeso(service.rate)} × ${hours ? hoursLabel(hours) : '—'}` : '—'}</dd>
        </div>
      </dl>
      <div className="summary-total">
        <span>Session total</span>
        <strong>{formatPeso(total)}</strong>
      </div>
      <div className="summary-split">
        <div>
          <span>Pay now ({Math.round(DOWNPAYMENT_RATE * 100)}%)</span>
          <strong>{formatPesoExact(downpayment)}</strong>
        </div>
        <div>
          <span>On shoot day</span>
          <strong>{formatPesoExact(total - downpayment)}</strong>
        </div>
      </div>
      <p className="summary-note">
        <Info size={14} aria-hidden="true" /> Transportation fee (if any) is added after review, before your shoot.
      </p>
    </div>
  );

  return (
    <section id="contact" className="section booking-section" ref={sectionRef}>
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">Book a session</p>
          <h2 className="section-title">Reserve your date</h2>
          <p className="section-lead">See open dates, get your price instantly and lock in your slot with a GCash downpayment. It takes about three minutes.</p>
        </header>

        <div className="booking-layout">
          <form className="booking-form" onSubmit={handleSubmit} noValidate>
            {isTeam && (
              <div className="notice notice-info">
                <Info size={18} aria-hidden="true" />
                <p>You are signed in as studio {user.role}. Bookings can only be made from customer accounts. Use the Admin dashboard to manage bookings.</p>
              </div>
            )}

            <fieldset className="booking-step" disabled={isTeam} data-field="serviceId">
              <legend>
                <span className="step-num">1</span> Choose a service
              </legend>
              <div className="service-options" role="radiogroup" aria-label="Service">
                {SERVICES.map((entry) => {
                  const Icon = SERVICE_ICONS[entry.icon];
                  const selected = draft.serviceId === entry.id;
                  return (
                    <label key={entry.id} className={`option-card ${selected ? 'is-selected' : ''}`}>
                      <input type="radio" name="service" value={entry.id} checked={selected} onChange={() => update({ serviceId: entry.id })} />
                      <Icon size={20} aria-hidden="true" />
                      <span className="option-title">{entry.title}</span>
                      <span className="option-sub">{formatPeso(entry.rate)}/hr</span>
                    </label>
                  );
                })}
              </div>
              {errors.serviceId && <p className="field-error">{errors.serviceId}</p>}
            </fieldset>

            <fieldset className="booking-step" disabled={isTeam}>
              <legend>
                <span className="step-num">2</span> Pick a date and time
              </legend>
              <div className="datetime-grid">
                <div data-field="date">
                  <BookingCalendar value={draft.date} onChange={(date) => update({ date, start: null })} availability={availability} />
                  {availability.status === 'error' && (
                    <p className="field-hint">We could not load live availability right now. You can still request a date and we will confirm it.</p>
                  )}
                  {errors.date && <p className="field-error">{errors.date}</p>}
                </div>

                <div className="datetime-side">
                  {!draft.date && <p className="field-hint datetime-empty">Pick an open date to see available start times.</p>}
                  {draft.date && (
                    <div className="time-picker" data-field="start">
                      <p className="field-label">Start time · {formatDateLong(draft.date)}</p>
                      <div className="time-chips">
                        {startOptions.length === 0 && <p className="field-hint">No start times left on this date. Please pick another day.</p>}
                        {startOptions.map((hour) => (
                          <button
                            key={hour}
                            type="button"
                            className={`chip chip-time ${draft.start === hour ? 'is-active' : ''}`}
                            aria-pressed={draft.start === hour}
                            onClick={() => update({ start: hour })}
                          >
                            {formatTime(hourToTime(hour))}
                          </button>
                        ))}
                      </div>
                      {errors.start && <p className="field-error">{errors.start}</p>}
                    </div>
                  )}

                  {draft.start !== null && (
                    <div className="time-picker" data-field="hours">
                      <p className="field-label">How long?</p>
                      <div className="time-chips">
                        {hourOptions.map((value) => {
                          const pack = service?.packages.find((entry) => entry.hours === value);
                          return (
                            <button
                              key={value}
                              type="button"
                              className={`chip chip-time ${hours === value ? 'is-active' : ''}`}
                              aria-pressed={hours === value}
                              onClick={() => update({ hours: value })}
                            >
                              {hoursLabel(value)}
                              {pack && <span className="chip-tag">{pack.name}</span>}
                            </button>
                          );
                        })}
                      </div>
                      {draft.hours && !hours && hourOptions.length > 0 && (
                        <p className="field-hint">{hoursLabel(draft.hours)} does not fit from this start time. Pick a shorter session or an earlier time.</p>
                      )}
                      {endHour && <p className="field-hint">Ends at {formatTime(hourToTime(endHour))}.</p>}
                      {errors.hours && <p className="field-error">{errors.hours}</p>}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className="booking-step" disabled={isTeam}>
              <legend>
                <span className="step-num">3</span> Your details
              </legend>
              {isCustomer && (
                <div className="account-box">
                  <span className="account-label">Booking as</span>
                  <strong>{user.fullName}</strong>
                  <span>{user.email}</span>
                  {accountPhone && <span>{accountPhone}</span>}
                </div>
              )}
              {isGuest && (
                <div className="notice">
                  <Lock size={18} aria-hidden="true" />
                  <p>
                    You will sign in or create a free account before paying. Your choices are saved on this device.{' '}
                    <button type="button" className="btn-link" onClick={() => onRequireAuth('signin')}>
                      Sign in now
                    </button>
                  </p>
                </div>
              )}
              {needsPhone && (
                <div className="field" data-field="phone">
                  <label htmlFor="booking-phone">Mobile number</label>
                  <input
                    id="booking-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0917 123 4567"
                    value={draft.phone}
                    onChange={(event) => update({ phone: event.target.value })}
                    aria-invalid={Boolean(errors.phone)}
                  />
                  <p className="field-hint">We will also save this to your profile for booking updates.</p>
                  {errors.phone && <p className="field-error">{errors.phone}</p>}
                </div>
              )}
              <div className="field" data-field="location">
                <label htmlFor="booking-location">Shoot location (full address)</label>
                <div className="input-icon">
                  <MapPin size={18} aria-hidden="true" />
                  <input
                    id="booking-location"
                    type="text"
                    autoComplete="street-address"
                    placeholder="e.g. 123 Tomas Morato Ave, Quezon City"
                    value={draft.location}
                    onChange={(event) => update({ location: event.target.value })}
                    aria-invalid={Boolean(errors.location)}
                  />
                </div>
                {errors.location && <p className="field-error">{errors.location}</p>}
              </div>
              <div className="field">
                <label htmlFor="booking-notes">
                  Notes <span className="optional">(optional)</span>
                </label>
                <textarea
                  id="booking-notes"
                  rows={3}
                  placeholder="Occasion, number of people, looks or shots you want…"
                  value={draft.notes}
                  onChange={(event) => update({ notes: event.target.value })}
                />
              </div>
            </fieldset>

            <fieldset className="booking-step" disabled={isTeam || !ready}>
              <legend>
                <span className="step-num">4</span> Secure your slot
              </legend>
              {!ready ? (
                <p className="field-hint">Choose a service, date and time first. Your downpayment amount will appear here.</p>
              ) : isGuest ? (
                <div className="auth-cta">
                  <ShieldCheck size={28} aria-hidden="true" />
                  <div>
                    <h4>Create a free account to reserve this date</h4>
                    <p>Your booking, payment receipt and photo delivery link stay together in your account.</p>
                  </div>
                  <div className="auth-cta-actions">
                    <button type="button" className="btn btn-primary" onClick={() => onRequireAuth('signup')}>
                      Create account
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => onRequireAuth('signin')}>
                      I have an account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="gcash-grid">
                  <div className="gcash-qr">
                    <img src="/gcash-qr.jpg" alt={`${STUDIO.name} GCash QR code`} width={220} height={220} loading="lazy" />
                    <p>
                      Send <strong>{formatPesoExact(downpayment)}</strong>
                      <span>{Math.round(DOWNPAYMENT_RATE * 100)}% downpayment via GCash</span>
                    </p>
                  </div>
                  <div className="gcash-proof">
                    <div className="field" data-field="reference">
                      <label htmlFor="booking-reference">GCash reference number</label>
                      <input
                        id="booking-reference"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="13-digit reference no."
                        value={reference}
                        onChange={(event) => {
                          setReference(event.target.value);
                          setErrors((current) => ({ ...current, reference: '' }));
                        }}
                        aria-invalid={Boolean(errors.reference)}
                      />
                      {errors.reference && <p className="field-error">{errors.reference}</p>}
                    </div>
                    <div className="field" data-field="receipt">
                      <span className="field-label">Receipt screenshot</span>
                      {receipt ? (
                        <div className="receipt-preview">
                          <img src={receipt.dataUrl} alt="Your GCash receipt" />
                          <div>
                            <strong>{receipt.name}</strong>
                            <span>
                              <Check size={14} aria-hidden="true" /> Ready to submit
                            </span>
                            <button type="button" className="btn-link btn-link-danger" onClick={() => setReceipt(null)}>
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label
                          className={`dropzone ${errors.receipt ? 'is-invalid' : ''}`}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            void handleReceipt(event.dataTransfer.files?.[0]);
                          }}
                        >
                          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(event) => void handleReceipt(event.target.files?.[0])} />
                          {receiptBusy ? <LoaderCircle size={22} className="spin" /> : <ImageUp size={22} aria-hidden="true" />}
                          <span>{receiptBusy ? 'Preparing image…' : 'Tap to upload or drop your screenshot'}</span>
                        </label>
                      )}
                      {errors.receipt && <p className="field-error">{errors.receipt}</p>}
                    </div>
                  </div>
                </div>
              )}
            </fieldset>

            <div className="summary-inline">{summary}</div>

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isTeam || submitting}>
              {submitting ? <LoaderCircle size={20} className="spin" /> : <CalendarCheck size={20} />}
              {isGuest ? 'Continue to reserve' : 'Review & submit booking'}
            </button>
            <p className="form-footnote">
              <ShieldCheck size={14} aria-hidden="true" /> Your date is held once we verify your downpayment. We confirm by email.
            </p>
          </form>

          <aside className="booking-aside">
            <div className="summary-aside">{summary}</div>
            <div className="contact-card">
              <h3>Prefer to talk first?</h3>
              <p>Ask about custom coverage, venues or group rates.</p>
              <a href={STUDIO.socials.messenger} target="_blank" rel="noopener noreferrer" className="contact-row">
                <MessageCircle size={18} aria-hidden="true" /> Messenger
              </a>
              <a href={STUDIO.phoneHref} className="contact-row">
                <Phone size={18} aria-hidden="true" /> {STUDIO.phoneDisplay}
              </a>
              <a href={`mailto:${STUDIO.email}`} className="contact-row">
                <Mail size={18} aria-hidden="true" /> {STUDIO.email}
              </a>
              <p className="contact-row contact-row-static">
                <MapPin size={18} aria-hidden="true" /> {STUDIO.location}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit this booking?"
        message="Please check the details. We will review your payment and confirm by email."
        confirmLabel={submitting ? 'Submitting…' : 'Submit booking'}
        icon={<CalendarCheck size={22} />}
        onCancel={() => !submitting && setConfirmOpen(false)}
        onConfirm={submitBooking}
      >
        <dl className="confirm-list">
          <div><dt>Service</dt><dd>{service?.title}</dd></div>
          <div><dt>Date</dt><dd>{draft.date && formatDateLong(draft.date)}</dd></div>
          <div><dt>Time</dt><dd>{draft.start !== null && endHour ? `${formatTime(hourToTime(draft.start))} – ${formatTime(hourToTime(endHour))} (${hoursLabel(hours || 0)})` : ''}</dd></div>
          <div><dt>Location</dt><dd>{draft.location}</dd></div>
          <div><dt>Total</dt><dd>{formatPesoExact(total)}</dd></div>
          <div><dt>Downpayment sent</dt><dd>{formatPesoExact(downpayment)} · Ref {reference}</dd></div>
          <div><dt>Balance on shoot day</dt><dd>{formatPesoExact(total - downpayment)} + transportation (if any)</dd></div>
        </dl>
      </ConfirmDialog>

      <Modal
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        size="sm"
        icon={<ShieldCheck size={22} />}
        title="Almost there"
        description="Create a free account or sign in to pay the downpayment and reserve your date. Your selections are saved."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => { setAuthPromptOpen(false); onRequireAuth('signin'); }}>
              Sign in
            </button>
            <button type="button" className="btn btn-primary" data-autofocus onClick={() => { setAuthPromptOpen(false); onRequireAuth('signup'); }}>
              Create account
            </button>
          </>
        }
      />
    </section>
  );
}
