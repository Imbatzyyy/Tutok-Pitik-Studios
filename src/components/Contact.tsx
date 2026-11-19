import { useBookingHold, uploadHoldReceipt, type SlotHold } from '../lib/booking-hold';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarCheck, Check, Copy, Download, ImageUp, Info, LoaderCircle, Lock, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Inquiry from './Inquiry';
import { countStep, visitContext } from '../lib/client-experience';
import BookingCalendar from './BookingCalendar';
import ConfirmDialog from './common/ConfirmDialog';
import PrivacyHighlight from './PrivacyHighlight';
import { SERVICE_ICONS } from './Services';
import { DOWNPAYMENT_RATE, SERVICES, STUDIO, findService } from '../content/site';
import { dayState, freeEndHours, freeStartHours, hourToTime, timeToHour, type AvailabilityState } from '../lib/availability';
import { normalizeBooking, buildBookingMessage } from '../lib/bookings';
import { formatDateLong, formatPeso, formatPesoExact, formatTime, hoursLabel } from '../lib/format';
import { compressImage } from '../lib/images';
import { errorMessage, notify } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useInView } from '../hooks/useInView';
import { markBookingResume, takeBookingResume } from '../lib/booking-resume';

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
  onPrefillUsed: () => void;
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
const QR_SRC = '/gcash-qr.jpg';
const QR_FILENAME = 'TutokPitikStudios-GCash-QR.jpg';

const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const EMPTY_DRAFT: Draft = { serviceId: '', date: null, start: null, hours: null, location: '', notes: '', phone: '' };

const loadDraft = (owner: string): Draft => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY + ':' + owner) || sessionStorage.getItem(DRAFT_KEY + ':guest');
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
};

const phoneLooksValid = (value: string) => value.replace(/\D/g, '').length >= 10;

export default function Contact({ user, availability, prefill, onPrefillUsed, onSuccess, onRequireAuth, onUserUpdated }: ContactProps) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft(user.id));
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<{ blob: Blob; dataUrl: string; name: string } | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bookingAgreed, setBookingAgreed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const payRef = useRef<HTMLFieldSetElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const qrFileRef = useRef<File | null>(null);
  const sectionInView = useInView(sectionRef, '-35% 0px -35% 0px');
  const submitInView = useInView(submitRef);

  const isGuest = !user || user.role === 'guest';
  const isCustomer = user?.role === 'customer';
  const isTeam = user && ['superadmin', 'admin', 'staff'].includes(user.role);
  const accountPhone = (user?.phone || '').trim();
  const needsPhone = isCustomer && !accountPhone;

  const resumeHold = useCallback((h: SlotHold) => {
    setDraft(d => ({...d, serviceId: findService(h.service)?.id || '', date:h.date, start:timeToHour(h.start), hours:timeToHour(h.end)-timeToHour(h.start)}));
  }, []);
  const finish = useCallback((row: any) => {
    const b = normalizeBooking(row);
    setDraft(EMPTY_DRAFT);
    setConfirmOpen(false);
    setReceipt(null);
    setReference('');
    onSuccess({reference:b.reference,service:b.service,date:b.date,dateDisplay:b.dateDisplay,startTime:b.startTime.slice(0,5),endTime:b.endTime.slice(0,5),
      time:b.time,hours:b.durationHours,total:b.totalAmount,downpayment:b.downpaymentAmount,balance:b.totalAmount-b.downpaymentAmount,location:b.location,email:b.email});
  }, [onSuccess]);
  const payment = useBookingHold(isCustomer ? user.id : null,resumeHold,finish);
  const [holdBusy,setHoldBusy] = useState(false);
  const [holdError,setHoldError] = useState('');
  const [caseNumber,setCaseNumber] = useState('');
  useEffect(() => { if (isCustomer) availability.reload(); }, [isCustomer, availability.reload]);
  useEffect(() => { setCaseNumber(''); }, [payment.hold?.id]);
  async function reportTransfer() {
    if (!payment.hold || holdBusy) return;
    setHoldBusy(true);
    setHoldError('');
    try {
      const {data,error} = await supabase.rpc('studio_report_paid_hold',{p_hold:payment.hold.id,p_reference:reference.trim()});
      if(error) throw error;
      setCaseNumber(data);
    } catch (error) { setHoldError(errorMessage(error)); }
    finally { setHoldBusy(false); }
  }
  const service = findService(draft.serviceId);
  const daySlots = draft.date ? availability.slots[draft.date] : undefined;
  const startOptions = useMemo(() => freeStartHours(daySlots), [daySlots]);
  const hourOptions = useMemo(() => (draft.start === null ? [] : freeEndHours(draft.start, daySlots).map((end) => end - (draft.start as number))), [draft.start, daySlots]);
  const hours = draft.hours && hourOptions.includes(draft.hours) ? draft.hours : null;
  const endHour = draft.start !== null && hours ? draft.start + hours : null;
  const total = service && hours ? service.rate * hours : 0;
  const downpayment = total * DOWNPAYMENT_RATE;
  const slotKnown = availability.status === 'ready' && availability.hasSlots && draft.date && ['open','limited'].includes(dayState(draft.date,availability));
  const ready = Boolean(slotKnown && service && draft.start !== null && hours);
  const held = payment.active && payment.hold?.service === service?.title && payment.hold?.date === draft.date && draft.start !== null &&
    timeToHour(payment.hold?.start) === draft.start && timeToHour(payment.hold?.end) === endHour;
  const canPay = ready && held && !payment.checking && !payment.problem;
  async function reserve() {
    if (holdBusy || payment.checking || payment.problem) return;
    if (!ready || !service || draft.start === null || !hours || !draft.date) {
      const field = !service ? 'serviceId' : !slotKnown ? 'date' : draft.start === null ? 'start' : 'hours';
      const hint = !service ? 'Choose your service first.' : availability.status !== 'ready' ? 'Retry live availability before paying.' : !slotKnown ? 'Choose an available date for your session.' : draft.start === null ? 'Choose an open start time.' : 'Choose your session duration.';
      setErrors({[field]:hint});
      setHoldError(hint);
      goToField(field);
      return;
    }
    if (draft.location.trim().length < 8 || (needsPhone && !phoneLooksValid(draft.phone))) {
      const field = draft.location.trim().length < 8 ? 'location' : 'phone';
      setErrors({[field]:field === 'location' ? 'Enter the complete venue address.' : 'Enter a valid mobile number.'});
      goToField(field); return;
    }
    setHoldBusy(true); setHoldError('');
    try {
      const {data,error} = await supabase.rpc('studio_hold_slot',{p_service:service.title,p_date:draft.date,p_start:hourToTime(draft.start),p_end:hourToTime(draft.start+hours)});
      if (error) throw error;
      payment.remember(data); countStep('slot',service.id);
    } catch (e) { setHoldError(errorMessage(e)); availability.reload(); }
    finally { setHoldBusy(false); }
  }
  async function release() {
    if (!payment.hold) return;
    setHoldBusy(true);
    try {
      const {error}=await supabase.rpc('studio_release_hold',{p_key:payment.hold.id});
      if(error)throw error;
      payment.remember(null); setHoldError(''); setReceipt(null); setReference(''); availability.reload();
    } catch(e) {setHoldError(errorMessage(e));} finally {setHoldBusy(false);}
  }

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
  };

  /** Bring one part of the form into view; text inputs also get focus. */
  const goToField = (key: string, block: ScrollLogicalPosition = 'center') => {
    const field = sectionRef.current?.querySelector<HTMLElement>(`[data-field="${key}"]`);
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block });
    field.querySelector<HTMLElement>('input:not([type="radio"]):not([type="file"]), textarea')?.focus({ preventScroll: true });
  };

  const requestAuth = (view: 'signin' | 'signup') => {
    markBookingResume();
    onRequireAuth(view);
  };

  // What the visitor still has to do, in form order. Drives the mobile booking bar.
  const nextStep: { label: string; field?: string } = !service
    ? { label: 'Choose a service', field: 'serviceId' }
    : !draft.date
      ? { label: 'Pick a date', field: 'date' }
      : draft.start === null
        ? { label: 'Pick a time', field: 'start' }
        : !hours
          ? { label: 'Choose length', field: 'hours' }
          : draft.location.trim().length < 8
            ? { label: 'Add location', field: 'location' }
            : needsPhone && !phoneLooksValid(draft.phone)
              ? { label: 'Add mobile no.', field: 'phone' }
              : isGuest
                ? { label: 'Continue' }
                : !canPay ? { label: 'Check payment hold', field: 'hold' } : reference.trim().length < 6
                  ? { label: 'Add GCash ref.', field: 'reference' }
                  : !receipt
                    ? { label: 'Upload receipt', field: 'receipt' }
                    : { label: 'Review & submit' };

  const handleBarAction = () => {
    if (nextStep.field) goToField(nextStep.field);
    else formRef.current?.requestSubmit();
  };

  // Back from sign-in (email or Google): continue where the visitor left off.
  useEffect(() => {
    if (!isCustomer || !takeBookingResume()) return;
    countStep('signup_return',service?.id);
    const timer = window.setTimeout(() => {
      if (ready && payRef.current) {
        payRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        payRef.current.focus({ preventScroll: true });
      } else {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomer]);

  // Preload the QR as a file so "Save QR" can open the phone's share sheet
  // (Save Image → Photos) without losing the tap's user activation.
  useEffect(() => {
    if (!isCustomer || !canPay || qrFileRef.current || !isTouchDevice()) return;
    let cancelled = false;
    fetch(QR_SRC)
      .then((response) => (response.ok ? response.blob() : Promise.reject()))
      .then((blob) => {
        if (!cancelled) qrFileRef.current = new File([blob], QR_FILENAME, { type: blob.type || 'image/jpeg' });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isCustomer, canPay]);

  const saveQr = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const file = qrFileRef.current;
    if (!file || !navigator.canShare?.({ files: [file] })) return; // fall back to the download link
    event.preventDefault();
    navigator.share({ files: [file], title: `${STUDIO.name} GCash QR` }).catch(() => undefined);
  };

  const copyAmount = async () => {
    const amount = String(Math.round(downpayment * 100) / 100);
    try {
      await navigator.clipboard.writeText(amount);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Amount to send: ${formatPesoExact(downpayment)}`);
    }
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY + ':' + user.id, JSON.stringify(draft));
      sessionStorage.removeItem(DRAFT_KEY);
      if (isCustomer) sessionStorage.removeItem(DRAFT_KEY + ':guest');
    } catch {
      /* storage blocked: draft only lives in memory */
    }
  }, [draft]);

  // Service / package buttons elsewhere on the page prefill the form.
  useEffect(() => {
    if (!prefill || payment.checking || !prefill.nonce) return;
    onPrefillUsed();
    if (payment.hold) return;
    setDraft((current) => ({
      ...current,
      serviceId: prefill.serviceId || current.serviceId,
      hours: prefill.hours || current.hours,
    }));
  }, [prefill, payment.checking]);

  // If the chosen start time stops being free (fresh availability), clear it.
  useEffect(() => {
    if (!payment.checking && !payment.hold && availability.status === 'ready' && draft.start !== null && draft.date && !startOptions.includes(draft.start)) {
      setDraft((current) => ({ ...current, start: null }));
    }
  }, [startOptions, draft.start, draft.date, payment.checking, payment.hold, availability.status]);

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
    if (firstKey) goToField(firstKey);
    return !firstKey;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isTeam) {
      toast.info('Bookings are for customer accounts', { description: 'Studio team accounts can manage bookings from the Admin dashboard.' });
      return;
    }
    if (isCustomer && !canPay) { if (payment.hold || payment.problem) goToField('hold'); else await reserve(); return; }
    if (!validate()) return;
    if (isGuest) {
      requestAuth('signup');
      return;
    }

    setBookingAgreed(false);
    setConfirmOpen(true);
  };

  const submitBooking = async () => {
    if (!bookingAgreed || submittingRef.current || !service || !draft.date || draft.start === null || !hours || !receipt || !payment.hold) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please sign in again.');

      const startTime = hourToTime(draft.start);
      const endTime = hourToTime(draft.start + hours);

      const holdId = payment.hold.id;
      const prior = await supabase.from('bookings').select('*').eq('user_id',session.user.id).eq('client_request_id',holdId).maybeSingle();
      if (prior.error) throw prior.error;
      if (prior.data) { payment.remember(null); finish(prior.data); return; }
      if (Date.parse(payment.hold.expires_at) <= Date.now()) throw new Error('Hold expired. If you paid, contact the studio using your hold reference. Do not pay again.');

      let phone = accountPhone;
      if (needsPhone) {
        phone = draft.phone.trim();
        const { error } = await supabase.from('users').update({ phone, updated_at: new Date().toISOString() }).eq('id', user.id);
        if (error) console.warn('Could not save phone to profile:', error.message);
        else onUserUpdated({ ...user, phone });
      }

      const receiptPath = await uploadHoldReceipt(user.id,holdId,receipt.blob);
      if(!receiptPath)throw new Error('Your receipt could not be uploaded securely. Please retry.');
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
        ...(navigator.doNotTrack==='1' ? {} : visitContext()),
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

      const { data: booking, error } = await supabase.rpc('studio_submit_held_booking',{p_payload:row,p_key:holdId});
      if (error || !booking) throw new Error(error?.message || 'We could not verify the booking. Please retry with this hold.');
      payment.remember(null);
      void notify('/send-booking-email', { bookingId: booking.id });
      availability.reload();
      countStep('submitted',service.id);
      finish(booking);
    } catch (error) {
      countStep('retry_failed',service.id); setConfirmOpen(false); setHoldError('If you already paid, keep your reference and do not send money again. ' + errorMessage(error)); payment.retry();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const summary = (
    <div className="summary-card">
      <h3>Booking summary</h3>
      {!service && (
        <p className="summary-empty">
          <CalendarCheck size={18} aria-hidden="true" />
          Choose a service, date and time. Your total and downpayment show up here instantly.
        </p>
      )}
      <dl hidden={!service}>
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
          <p className="section-lead">Choose your session and check the price. Sign in to hold a time before paying with GCash.</p>
        </header>

        <div className="booking-layout">
          <form className="booking-form" onSubmit={handleSubmit} noValidate ref={formRef}>
            {isTeam && (
              <div className="notice notice-info">
                <Info size={18} aria-hidden="true" />
                <p>You are signed in as studio {user.role}. Bookings can only be made from customer accounts. Use the Admin dashboard to manage bookings.</p>
              </div>
            )}

            <fieldset className="booking-step" disabled={isTeam || payment.active} data-field="serviceId">
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

            <fieldset className="booking-step" disabled={isTeam || payment.active}>
              <legend>
                <span className="step-num">2</span> Pick a date and time
              </legend>
              <div className="datetime-grid">
                <div id="open-dates" tabIndex={-1} data-field="date">
                  <BookingCalendar value={draft.date} onChange={(date) => update({ date, start: null })} availability={availability} disabled={availability.status !== 'ready'} />
                  {availability.status === 'error' && (
                    <p className="field-hint">We could not load live availability right now. Your draft is saved. Retry before you pay. <button type="button" className="btn-link" onClick={availability.reload}>Retry availability</button></p>
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
                    <button type="button" className="btn-link" onClick={() => requestAuth('signin')}>
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

            <fieldset className="booking-step" disabled={isTeam} data-field="hold" ref={payRef} tabIndex={-1} aria-label="Step 4: Secure your slot">
              <legend>
                <span className="step-num">4</span> Secure your slot
              </legend>
              {payment.hold && <div className="notice"><div><strong>{payment.active ? 'Payment hold until ' + new Date(payment.hold.expires_at).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'}) + ' Manila time' : 'This payment hold has ended'}</strong>
                <p>Hold reference: {payment.hold.id}</p>
                <details><summary>Already transferred and need help?</summary>
                  <p>Please keep your receipt and pay only once. Send the transaction reference to the studio for manual reconciliation.</p>
                  <label>GCash transaction reference<input maxLength={40} value={reference} onChange={e=>setReference(e.target.value)} /></label>
                  <button type="button" className="btn btn-secondary" disabled={holdBusy || reference.trim().length<6 || !!caseNumber} onClick={reportTransfer}>Report my transfer</button>
                  {caseNumber && <p role="status">The studio received your report. Case {caseNumber}. We will contact you by email.</p>}
                  <a href={'mailto:'+STUDIO.email+'?subject='+encodeURIComponent('Payment help for hold '+payment.hold.id)}>Email the studio</a>
                </details>
                <button type="button" className="btn-link" disabled={holdBusy || submitting} onClick={release}>I have not paid · release this hold</button></div></div>}
              {availability.status === 'ready' && availability.rules.review_hours && <p className="field-hint">Studio review target: within {availability.rules.review_hours} hours of submission.</p>}
              {holdError && <p role="alert" className="field-error">{holdError}</p>}
              {payment.checking ? <p role="status">Checking your reservation…</p> : payment.problem ? <p role="alert">{payment.problem} <button type="button" onClick={payment.retry}>Retry</button></p> : !ready ? (
                <p className="field-hint">Choose a service, date and time first. Your downpayment amount will appear here.</p>
              ) : isGuest ? (
                <div className="auth-cta">
                  <ShieldCheck size={28} aria-hidden="true" />
                  <div>
                    <h4>Create a free account to reserve this date</h4>
                    <p>Your booking, payment receipt and photo delivery link stay together in your account.</p>
                  </div>
                  <div className="auth-cta-actions">
                    <button type="button" className="btn btn-primary" onClick={() => requestAuth('signup')}>
                      Create account
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => requestAuth('signin')}>
                      I have an account
                    </button>
                  </div>
                </div>
              ) : !canPay ? (
                <div><p>Check availability and hold your time for 15 minutes before sending a deposit.</p>
                {!payment.hold && <button type="button" className="btn btn-primary" disabled={holdBusy} onClick={reserve}>{holdBusy ? 'Checking…' : 'Hold this time for payment'}</button>}</div>
              ) : (
                <div className="gcash-grid">
                  <div className="gcash-pay">
                    <div className="gcash-qr">
                      <img src={QR_SRC} alt={`${STUDIO.name} GCash QR code`} width={220} height={220} loading="lazy" />
                      <p>
                        Send <strong>{formatPesoExact(downpayment)}</strong>
                        <span>{Math.round(DOWNPAYMENT_RATE * 100)}% downpayment via GCash</span>
                      </p>
                    </div>
                    <div className="gcash-actions">
                      <a className="btn btn-ghost btn-sm" href={QR_SRC} download={QR_FILENAME} onClick={saveQr}>
                        <Download size={16} aria-hidden="true" /> Save QR
                      </a>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyAmount()} aria-live="polite">
                        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                        {copied ? 'Copied' : 'Copy amount'}
                      </button>
                    </div>
                  </div>
                  <div className="gcash-proof">
                    <ol className="gcash-howto">
                      <li>
                        <strong>Open the QR in GCash.</strong> On a computer, scan it with your phone. On this phone, tap <em>Save QR</em>, then in GCash choose <em>QR</em> → <em>Upload QR</em> and pick the saved image.
                      </li>
                      <li>
                        <strong>Send exactly {formatPesoExact(downpayment)}.</strong> <em>Copy amount</em> pastes it for you.
                      </li>
                      <li>
                        <strong>Add the reference number and screenshot</strong> from your GCash receipt below.
                      </li>
                    </ol>
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
            <PrivacyHighlight />

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isTeam || submitting} ref={submitRef}>
              {submitting ? <LoaderCircle size={20} className="spin" /> : <CalendarCheck size={20} />}
              {isGuest ? 'Continue to reserve' : canPay ? 'Review & submit booking' : 'Check payment hold'}
            </button>
            <p className="form-footnote">
              <ShieldCheck size={14} aria-hidden="true" /> The studio reviews your submitted receipt and confirms the booking in your account and by email.
            </p>
          </form>

          <aside className="booking-aside">
            <Inquiry serviceId={service?.id} />
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
        confirmDisabled={!bookingAgreed || submitting}
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
          <div><dt>Balance on shoot day</dt><dd>{formatPesoExact(total - downpayment)} after verification, plus agreed travel costs</dd></div>
        </dl>
        <label className="checkbox checkbox-block agreement-box">
          <input type="checkbox" checked={bookingAgreed} aria-describedby="booking-agreement-help" onChange={(event) => setBookingAgreed(event.target.checked)} />
          <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> and acknowledge that I have read the <a href="/privacy" target="_blank" rel="noopener noreferrer">Data Privacy Notice (RA 10173)</a>.</span>
        </label>
        <p id="booking-agreement-help" className="agreement-help">Links open in a new tab. Your details are used to manage this booking and send service emails. This does not authorize marketing or public use of your photos.</p>
      </ConfirmDialog>

      {!isTeam && (
        <div className={`booking-bar ${sectionInView && !submitInView && !confirmOpen ? 'is-visible' : ''}`} aria-hidden={!sectionInView || submitInView}>
          <div className="booking-bar-info">
            {service ? (
              <>
                <span className="booking-bar-title">
                  {service.title.replace(' Photography', '').replace(' & Architecture', ' & Arch.')}
                  {draft.date && ` · ${new Date(`${draft.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  {draft.start !== null && `, ${formatTime(hourToTime(draft.start))}`}
                </span>
                <span className="booking-bar-price">
                  {hours ? (
                    <>
                      <strong>{formatPeso(total)}</strong> · {formatPeso(downpayment)} now
                    </>
                  ) : (
                    `${formatPeso(service.rate)}/hr`
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="booking-bar-title">Book in about 3 minutes</span>
                <span className="booking-bar-price">Live prices · {Math.round(DOWNPAYMENT_RATE * 100)}% down via GCash</span>
              </>
            )}
          </div>
          <button type="button" className="btn btn-primary booking-bar-action" onClick={handleBarAction} tabIndex={sectionInView && !submitInView ? 0 : -1}>
            {nextStep.label} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
