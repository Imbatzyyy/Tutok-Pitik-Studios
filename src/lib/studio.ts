import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isDemoMode } from './supabase';
import { askConfirm } from './confirm';

export async function rpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/* ---------- Formatting: every studio date and time is shown in Manila time ---------- */

const MANILA = 'Asia/Manila';
const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: MANILA, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: MANILA, day: 'numeric', month: 'short' });
const stampDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: MANILA, day: 'numeric', month: 'short', year: 'numeric' });
const stampTimeFormat = new Intl.DateTimeFormat('en-US', { timeZone: MANILA, hour: 'numeric', minute: '2-digit', hour12: true });
const monthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: MANILA, month: 'short', year: 'numeric' });

const isDateKey = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
const noonInManila = (key: string) => new Date(`${key.slice(0, 10)}T12:00:00+08:00`);

export const money = (value: unknown) => {
  const amount = Number(value) || 0;
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: decimals, maximumFractionDigits: 2 }).format(amount);
};

/** "Thu, 19 Nov 2026" */
export const formatDay = (key: unknown) => (isDateKey(key) ? dayFormat.format(noonInManila(key)) : 'No date');

/** "19 Nov" */
export const formatDayShort = (key: unknown) => (isDateKey(key) ? shortDayFormat.format(noonInManila(key)) : '—');

/** Day number, short month and weekday for date tiles. */
export const dateParts = (key: unknown) => {
  if (!isDateKey(key)) return { day: '—', month: '', weekday: '' };
  const date = noonInManila(key);
  return {
    day: String(Number(key.slice(8, 10))),
    month: new Intl.DateTimeFormat('en-GB', { timeZone: MANILA, month: 'short' }).format(date),
    weekday: new Intl.DateTimeFormat('en-GB', { timeZone: MANILA, weekday: 'short' }).format(date),
  };
};

/** "14:00:00" → "2:00 PM" */
export const formatClock = (time: unknown) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
  if (!match) return '—';
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? 'PM' : 'AM'}`;
};

/** "2:00 – 6:00 PM" or "11:00 AM – 1:00 PM" */
export const formatTimeRange = (start: unknown, end: unknown) => {
  const from = formatClock(start);
  const to = formatClock(end);
  if (from === '—' || to === '—') return from === '—' ? to : from;
  const sameHalf = from.slice(-2) === to.slice(-2);
  return `${sameHalf ? from.slice(0, -3) : from} – ${to}`;
};

/** "12 Nov 2026, 9:42 PM" for timestamps. */
export const formatStamp = (value: unknown) => {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '—';
  return `${stampDateFormat.format(date)}, ${stampTimeFormat.format(date)}`;
};

/** "2026-11" → "Nov 2026" */
export const formatMonth = (value: unknown) => {
  const match = /^(\d{4})-(\d{2})/.exec(String(value || ''));
  return match ? monthFormat.format(new Date(`${match[1]}-${match[2]}-15T12:00:00+08:00`)) : String(value || '');
};

const WORDS: Record<string, string> = {
  superadmin: 'Super admin',
  super_admin: 'Super admin',
  tps: 'TPS',
  gcash: 'GCash',
};

/** Database words for people: "not_started" → "Not started". */
export const label = (value: unknown) => {
  const text = String(value ?? '');
  if (!text) return '';
  if (WORDS[text.toLowerCase()]) return WORDS[text.toLowerCase()];
  const words = text.replaceAll('_', ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const reservationTone = (status: unknown): Tone =>
  ({ pending: 'warning', confirmed: 'success', completed: 'info', cancelled: 'danger' } as Record<string, Tone>)[String(status)] || 'neutral';

const PAYMENT_TEXT: Record<string, [string, Tone]> = {
  awaiting_proof: ['Awaiting payment proof', 'neutral'],
  under_review: ['Payment to review', 'warning'],
  rejected: ['Proof rejected', 'danger'],
  deposit_verified: ['Deposit verified', 'success'],
  partially_paid: ['Partly paid', 'info'],
  paid: ['Paid in full', 'success'],
  refund_pending: ['Refund pending', 'warning'],
  refunded: ['Refunded', 'neutral'],
  verified: ['Verified', 'success'],
  pending: ['Pending review', 'warning'],
};
export const paymentText = (state: unknown) => PAYMENT_TEXT[String(state)]?.[0] || label(state) || 'No payment yet';
export const paymentTone = (state: unknown): Tone => PAYMENT_TEXT[String(state)]?.[1] || 'neutral';

const GALLERY_TEXT: Record<string, [string, Tone]> = {
  not_started: ['Gallery not started', 'neutral'],
  editing: ['Editing photos', 'info'],
  ready: ['Gallery ready', 'success'],
  delivered: ['Gallery delivered', 'success'],
  revision_requested: ['Revision requested', 'warning'],
};
export const galleryText = (status: unknown) => GALLERY_TEXT[String(status)]?.[0] || label(status);
export const galleryTone = (status: unknown): Tone => GALLERY_TEXT[String(status)]?.[1] || 'neutral';

export const requestTone = (status: unknown): Tone =>
  ({ pending: 'warning', approved: 'success', declined: 'danger', withdrawn: 'neutral' } as Record<string, Tone>)[String(status)] || 'neutral';

/** Reference shown to people, e.g. TPS-B1001A. */
export const bookingRef = (id: unknown) => `TPS-${String(id || '').slice(0, 6).toUpperCase()}`;

/** Today's date in Manila as YYYY-MM-DD. */
export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: MANILA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** A Manila date key `days` from today (negative for the past). */
export const addDaysKey = (days: number) => {
  const date = new Date(`${todayKey()}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: MANILA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};

/** Booking sections a link can open straight into. */
export type BookingTab = 'details' | 'payments' | 'requests' | 'preparation' | 'conversation' | 'history' | 'emails';
export type NextStep = { text: string; tone: Tone; tab: BookingTab; action: string };

/** What a booking needs from the studio next, most urgent first. */
export function nextSteps(b: Record<string, any>): NextStep[] {
  const steps: NextStep[] = [];
  if (!b || b.status === 'cancelled' || b.archived_at) return steps;
  const galleryDone = ['ready', 'delivered'].includes(b.gallery_status);
  if (b.payment_state === 'under_review') steps.push({ text: 'Verify payment', tone: 'warning', tab: 'payments', action: 'Review payment' });
  if (b.status === 'pending' && b.payment_state !== 'under_review') steps.push({ text: 'Confirm or decline', tone: 'warning', tab: 'details', action: 'Decide' });
  if (!b.assigned_to && ['pending', 'confirmed'].includes(b.status)) steps.push({ text: 'Assign photographer', tone: 'info', tab: 'details', action: 'Assign' });
  if (b.needs_information) steps.push({ text: 'Waiting for client', tone: 'neutral', tab: 'conversation', action: 'Message client' });
  if (b.delivery_due && b.delivery_due < todayKey() && !galleryDone) steps.push({ text: 'Gallery overdue', tone: 'danger', tab: 'details', action: 'Update delivery' });
  else if (b.status === 'completed' && !galleryDone) steps.push({ text: 'Deliver gallery', tone: 'info', tab: 'details', action: 'Update delivery' });
  return steps;
}

/* ---------- Live refresh ---------- */

export type LiveState = 'Preview' | 'Connecting' | 'Live' | 'Reconnecting' | 'Offline';

/** Private refresh signals contain no customer data. Every refresh rechecks RLS. */
export function useStudioLive(userId: string, team: boolean, onRefresh: () => void, enabled = true) {
  const fn = useRef(onRefresh);
  fn.current = onRefresh;
  const [state, setState] = useState<LiveState>(isDemoMode ? 'Preview' : navigator.onLine ? 'Connecting' : 'Offline');

  useEffect(() => {
    if (!enabled || isDemoMode) return;
    let disposed = false;
    let debounce: number;
    let channel: ReturnType<typeof supabase.channel>;
    const refresh = () => {
      clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        if (!disposed) fn.current();
      }, 250);
    };
    const connect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (disposed || !session) return;
      await supabase.realtime.setAuth(session.access_token);
      if (disposed) return;
      channel = supabase
        .channel(team ? 'studio:team' : `studio:user:${userId}`, { config: { private: true } })
        .on('broadcast', { event: 'changed' }, refresh)
        .subscribe((status) => {
          if (disposed) return;
          setState(status === 'SUBSCRIBED' ? 'Live' : navigator.onLine ? 'Reconnecting' : 'Offline');
          if (status === 'SUBSCRIBED') refresh();
        });
    };
    void connect();
    const online = () => {
      setState('Reconnecting');
      refresh();
    };
    const offline = () => setState('Offline');
    const visible = () => {
      if (!document.hidden && navigator.onLine) refresh();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(visible, 60_000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void supabase.realtime.setAuth(session.access_token);
    });
    return () => {
      disposed = true;
      clearTimeout(debounce);
      clearInterval(timer);
      subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [userId, team, enabled]);

  return state;
}

/* ---------- Unsaved changes ---------- */

const unsavedForms = new Set<symbol>();
export const hasUnsavedChanges = () => unsavedForms.size > 0;

/** Resolves true when it is safe to leave: nothing unsaved, or the person chose to discard. */
export const confirmNavigation = async () =>
  !hasUnsavedChanges() ||
  askConfirm({
    title: 'Discard unsaved changes?',
    message: 'You have changes that are not saved yet. Leaving now will discard them.',
    confirmLabel: 'Discard changes',
    cancelLabel: 'Keep editing',
    tone: 'danger',
  });

export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const key = Symbol();
    unsavedForms.add(key);
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => {
      unsavedForms.delete(key);
      window.removeEventListener('beforeunload', guard);
    };
  }, [dirty]);
}

/* ---------- Data loading ---------- */

export function useResource<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const run = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refresh = useCallback(async () => {
    const n = ++run.current;
    try {
      const value = await load();
      if (n === run.current) {
        setData(value);
        setError('');
      }
    } catch (e) {
      if (n === run.current) setError(e instanceof Error ? e.message : 'Could not load data');
    } finally {
      if (n === run.current) setLoading(false);
    }
  }, deps);
  useEffect(() => {
    setLoading(true);
    void refresh();
    return () => {
      run.current++;
    };
  }, [refresh]);
  return { data, error, loading, refresh };
}

/* ---------- Files ---------- */

export function download(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csv(rows: unknown[][]) {
  return (
    '﻿' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? '');
            if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(',')
      )
      .join('\r\n')
  );
}

export function calendarFile(booking: any) {
  const escape = (value: unknown) => String(value ?? '').replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
  const stamp = (date: string, time: string) => new Date(`${date}T${time.slice(0, 8)}+08:00`).toISOString().replace(/[-:]/g, '').replace('.000', '');
  download(
    `TPS-${booking.id.slice(0, 6)}.ics`,
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tutok Pitik Studios//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${booking.id}@tutokpitikstudios.com`,
      `DTSTAMP:${stamp(booking.booking_date, booking.start_time)}`,
      `DTSTART:${stamp(booking.booking_date, booking.start_time)}`,
      `DTEND:${stamp(booking.booking_date, booking.end_time)}`,
      `SUMMARY:${escape(booking.service)} · Tutok Pitik Studios`,
      `LOCATION:${escape(booking.location)}`,
      `DESCRIPTION:${escape('Booking ' + booking.id + ' · ' + label(booking.status))}`,
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n'),
    'text/calendar'
  );
}

export async function uploadPrivate(bucket: string, user: string, file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file under 10 MB.');
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) throw new Error('Use JPG, PNG, WebP or PDF.');
  const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1];
  const path = `${user}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error('Upload failed. Keep this page open and retry.');
  return path;
}

export async function openPrivate(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new Error('This file is unavailable or you do not have access.');
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
