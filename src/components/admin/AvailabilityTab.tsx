import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarOff, CalendarX, Database, LoaderCircle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../common/ConfirmDialog';
import { errorMessage, isMissingRelation } from '../../lib/api';
import { formatDateLong, parseDateKey, toDateKey } from '../../lib/format';
import { rpc } from '../../lib/studio';
import { supabase } from '../../lib/supabase';
import { addDaysKey, todayKey } from './shared';

interface BlockedDate {
  id: string;
  date: string;
  reason: string;
}

const MAX_RANGE_DAYS = 62;
/** The studio calendar answers at most 42 days per request. */
const CALENDAR_CHUNK = 42;
const shiftKey = (key: string, days: number) => {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

/** Count active (not cancelled, not archived) bookings per date, in calendar-sized chunks. */
async function countBookings(from: string, to: string) {
  const counts: Record<string, number> = {};
  for (let start = from; start <= to; start = shiftKey(start, CALENDAR_CHUNK)) {
    const end = [shiftKey(start, CALENDAR_CHUNK - 1), to].sort()[0];
    const rows = await rpc<{ booking_date: string }[]>('studio_calendar', { p_from: start, p_to: end, p_mine: false });
    rows.forEach((row) => {
      counts[row.booking_date] = (counts[row.booking_date] || 0) + 1;
    });
  }
  return counts;
}

export default function AvailabilityTab({ embedded = false }: { embedded?: boolean }) {
  const [rows, setRows] = useState<BlockedDate[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [removing, setRemoving] = useState<BlockedDate | null>(null);
  const today = todayKey();

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('blocked_dates').select('*').order('blocked_date', { ascending: true });
    if (loadError) {
      setState(isMissingRelation(loadError) ? 'missing' : 'error');
      return;
    }
    setRows((data || []).map((row: any) => ({ id: String(row.id), date: String(row.blocked_date).slice(0, 10), reason: row.reason || '' })));
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [activeByDate, setActiveByDate] = useState<Record<string, number>>({});
  const [checkedThrough, setCheckedThrough] = useState('');

  // Existing bookings for the next four months, so blocking a busy day shows a warning.
  const loadCounts = useCallback(async (from: string, to: string) => {
    try {
      const counts = await countBookings(from, to);
      setActiveByDate((current) => ({ ...current, ...counts }));
      setCheckedThrough((current) => (to > current ? to : current));
    } catch {
      /* The warning is a convenience; blocking still works without it. */
    }
  }, []);

  useEffect(() => {
    void loadCounts(today, addDaysKey(125));
  }, [loadCounts, today]);

  useEffect(() => {
    if (!start || !checkedThrough) return;
    const last = end && end >= start ? end : start;
    if (last > checkedThrough) void loadCounts(start, [last, shiftKey(start, MAX_RANGE_DAYS)].sort()[0]);
  }, [start, end, checkedThrough, loadCounts]);

  const clashesInRange = useMemo(() => {
    if (!start) return 0;
    const last = end && end >= start ? end : start;
    return Object.entries(activeByDate).filter(([date, count]) => date >= start && date <= last && count > 0).length;
  }, [activeByDate, start, end]);

  const upcoming = rows.filter((row) => row.date >= today);
  const past = rows.filter((row) => row.date < today).reverse();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!start) {
      setError('Pick a date to block.');
      return;
    }
    const last = end || start;
    if (last < start) {
      setError('The end date must be on or after the start date.');
      return;
    }
    const dates: string[] = [];
    const cursor = parseDateKey(start);
    while (toDateKey(cursor) <= last) {
      dates.push(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
      if (dates.length > MAX_RANGE_DAYS) {
        setError(`Block at most ${MAX_RANGE_DAYS} days at a time.`);
        return;
      }
    }
    const existing = new Set(rows.map((row) => row.date));
    const fresh = dates.filter((date) => !existing.has(date));
    if (fresh.length === 0) {
      setError(dates.length === 1 ? 'That date is already blocked.' : 'Those dates are already blocked.');
      return;
    }

    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('blocked_dates').insert(fresh.map((date) => ({ blocked_date: date, reason: reason.trim() || null })));
      if (insertError) throw insertError;
      const counts = await countBookings(fresh[0], fresh[fresh.length - 1]).catch(() => activeByDate);
      const clashes = fresh.filter((date) => counts[date]);
      toast.success(`${fresh.length} ${fresh.length === 1 ? 'date' : 'dates'} blocked`, {
        description: clashes.length ? `${clashes.length} of them already have bookings. Those bookings are not changed.` : undefined,
      });
      setStart('');
      setEnd('');
      setReason('');
      await load();
    } catch (insertError) {
      toast.error(errorMessage(insertError, 'Could not block these dates.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    const { error: deleteError } = await supabase.from('blocked_dates').delete().eq('id', removing.id);
    if (deleteError) {
      toast.error(deleteError.message || 'Could not unblock this date.');
      return;
    }
    toast.success(`${formatDateLong(removing.date)} is open for booking again`);
    setRemoving(null);
    await load();
  };

  return (
    <section className={embedded ? 'ops-block-days' : 'admin-section'} aria-labelledby="availability-title">
      <header className="admin-head">
        <div>
          {embedded ? <h2 id="availability-title">Block whole days</h2> : <h1 id="availability-title">Availability</h1>}
          <p>Days you can’t shoot. Clients won’t be able to pick them on the website.</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="icon-btn" onClick={() => void load()} aria-label="Refresh blocked dates" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {state === 'missing' && (
        <div className="notice notice-warning">
          <Database size={18} />
          <span>
            The <code>blocked_dates</code> table does not exist yet. Apply the Supabase migration in <code>supabase/migrations</code> to turn on date blocking.
          </span>
        </div>
      )}
      {state === 'error' && (
        <div className="notice notice-danger">
          Blocked dates could not be loaded. <button type="button" className="btn-link" onClick={() => void load()}>Try again</button>
        </div>
      )}
      {state === 'loading' && (
        <div className="loading-row">
          <LoaderCircle size={20} className="spin" /> Loading…
        </div>
      )}

      {state === 'ready' && (
        <div className="admin-grid-2 admin-grid-avail">
          <form className="admin-card" onSubmit={submit} noValidate>
            <div className="admin-card-head">
              <h2>Block dates</h2>
              <span>One day or a range</span>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="av-start">From</label>
                <input id="av-start" type="date" min={today} value={start} onChange={(event) => setStart(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="av-end">
                  To <span className="optional">(optional)</span>
                </label>
                <input id="av-end" type="date" min={start || today} value={end} onChange={(event) => setEnd(event.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="av-reason">
                Reason <span className="optional">(optional, not shown on the website)</span>
              </label>
              <input id="av-reason" type="text" maxLength={120} placeholder="e.g. Out of town, holiday, fully booked" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            {error && <p className="field-error form-note">{error}</p>}
            {start && (!end || end === start) && activeByDate[start] > 0 && (
              <p className="notice notice-warning">
                {activeByDate[start]} active {activeByDate[start] === 1 ? 'booking is' : 'bookings are'} already on {formatDateLong(start)}. Blocking won’t cancel{' '}
                {activeByDate[start] === 1 ? 'it' : 'them'}.
              </p>
            )}
            {start && end && end > start && clashesInRange > 0 && (
              <p className="notice notice-warning">
                {clashesInRange} of these {clashesInRange === 1 ? 'day already has' : 'days already have'} bookings. Blocking won’t cancel them.
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />} Block {end && end !== start ? 'dates' : 'date'}
            </button>
          </form>

          <div className="admin-card">
            <div className="admin-card-head">
              <h2>Upcoming blocked dates</h2>
              <span>{upcoming.length}</span>
            </div>
            {upcoming.length === 0 ? (
              <div className="empty-state compact">
                <CalendarOff size={28} />
                <p>No dates blocked. Every day in the booking window is open.</p>
              </div>
            ) : (
              <ul className="blocked-list">
                {upcoming.map((row) => (
                  <BlockedRow key={row.id} row={row} clashes={activeByDate[row.date] || 0} onRemove={() => setRemoving(row)} />
                ))}
              </ul>
            )}
            {past.length > 0 && (
              <>
                <button type="button" className="btn-link blocked-past-toggle" onClick={() => setShowPast((value) => !value)} aria-expanded={showPast}>
                  {showPast ? 'Hide' : 'Show'} {past.length} past {past.length === 1 ? 'date' : 'dates'}
                </button>
                {showPast && (
                  <ul className="blocked-list is-past">
                    {past.map((row) => (
                      <BlockedRow key={row.id} row={row} clashes={0} onRemove={() => setRemoving(row)} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title="Open this date again?"
        message={removing ? `${formatDateLong(removing.date)} will be available for booking.` : ''}
        confirmLabel="Unblock date"
        icon={<CalendarX size={22} />}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}

function BlockedRow({ row, clashes, onRemove }: { row: BlockedDate; clashes: number; onRemove: () => void }) {
  const date = parseDateKey(row.date);
  return (
    <li>
      <span className="mini-date">
        <strong>{date.getDate()}</strong>
        <span>{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
      </span>
      <span className="mini-body">
        <strong>{date.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
        <span>{row.reason || 'No reason given'}</span>
        {clashes > 0 && <span className="badge badge-warning">{clashes} active {clashes === 1 ? 'booking' : 'bookings'} that day</span>}
      </span>
      <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={onRemove} aria-label={`Unblock ${row.date}`} title="Unblock">
        <Trash2 size={16} />
      </button>
    </li>
  );
}
