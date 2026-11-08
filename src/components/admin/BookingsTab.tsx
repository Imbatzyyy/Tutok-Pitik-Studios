import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FileDown, Inbox, List, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../common/ConfirmDialog';
import BookingDetail from './BookingDetail';
import { errorMessage } from '../../lib/api';
import { BOOKING_STATUSES, paymentLabel, paymentTone, statusLabel, statusTone, type BookingStatus, type NormalizedBooking } from '../../lib/bookings';
import { formatDateShort, formatPeso, formatTime, toDateKey } from '../../lib/format';
import type { SessionUser } from '../../lib/session';
import { SERVICES } from '../../content/site';
import { includesText, saveBooking, todayKey } from './shared';
import type { LoadState } from './AdminDashboard';

interface BookingsTabProps {
  user: SessionUser;
  bookings: NormalizedBooking[];
  state: LoadState;
  onReload: () => Promise<void> | void;
  onReplace: (booking: NormalizedBooking) => void;
  onRemove: (id: string) => void;
  focusId: string | null;
  onFocusHandled: () => void;
}

type SortKey = 'newest' | 'shoot-asc' | 'shoot-desc' | 'upcoming';
const PAGE_SIZE = 12;

const NEXT_STEP: Partial<Record<BookingStatus, { status: BookingStatus; label: string }>> = {
  pending: { status: 'confirmed', label: 'Confirm' },
  confirmed: { status: 'completed', label: 'Mark done' },
};

export default function BookingsTab({ user, bookings, state, onReload, onReplace, onRemove, focusId, onFocusHandled }: BookingsTabProps) {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | BookingStatus>('all');
  const [service, setService] = useState('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [quick, setQuick] = useState<{ booking: NormalizedBooking; status: BookingStatus } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (focusId) {
      setOpenId(focusId);
      onFocusHandled();
    }
  }, [focusId, onFocusHandled]);

  useEffect(() => setPage(0), [query, status, service, sort]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: bookings.length };
    BOOKING_STATUSES.forEach((entry) => {
      map[entry.value] = bookings.filter((booking) => booking.status === entry.value).length;
    });
    return map;
  }, [bookings]);

  const filtered = useMemo(() => {
    const today = todayKey();
    const list = bookings.filter((booking) => {
      if (status !== 'all' && booking.status !== status) return false;
      if (service !== 'all' && !booking.service.toLowerCase().startsWith(service.toLowerCase())) return false;
      if (sort === 'upcoming' && (booking.date < today || booking.status === 'cancelled' || booking.status === 'completed')) return false;
      return includesText([booking.fullName, booking.email, booking.phone, booking.reference, booking.location, booking.paymentReference, booking.service], query);
    });
    const byShoot = (a: NormalizedBooking, b: NormalizedBooking) => (a.date + a.startTime).localeCompare(b.date + b.startTime);
    if (sort === 'newest') list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'shoot-asc' || sort === 'upcoming') list.sort(byShoot);
    if (sort === 'shoot-desc') list.sort((a, b) => byShoot(b, a));
    return list;
  }, [bookings, status, service, sort, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const openBooking = bookings.find((booking) => booking.id === openId) || null;

  const runQuick = async () => {
    if (!quick) return;
    try {
      const saved = await saveBooking(quick.booking, {
        status: quick.status,
        paymentStatus: quick.status === 'confirmed' ? 'verified' : undefined,
      });
      onReplace(saved);
      toast.success(quick.status === 'confirmed' ? `Confirmed. ${saved.fullName} is being emailed.` : `${saved.reference} marked ${statusLabel(quick.status).toLowerCase()}`);
      setQuick(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update this booking.'));
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { exportBookingsPdf } = await import('../../lib/pdf');
      await exportBookingsPdf(filtered);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the PDF.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="admin-section" aria-labelledby="bookings-title">
      <header className="admin-head">
        <div>
          <h1 id="bookings-title">Bookings</h1>
          <p>
            {counts.pending ? `${counts.pending} waiting for review · ` : ''}
            {bookings.length} total
          </p>
        </div>
        <div className="admin-head-actions">
          <div className="segmented segmented-sm" role="group" aria-label="View">
            <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>
              <List size={16} /> List
            </button>
            <button type="button" className={view === 'calendar' ? 'is-active' : ''} aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>
              <CalendarDays size={16} /> Calendar
            </button>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportPdf} disabled={exporting || filtered.length === 0}>
            {exporting ? <LoaderCircle size={16} className="spin" /> : <FileDown size={16} />} Export PDF
          </button>
          <button type="button" className="icon-btn" onClick={() => void onReload()} aria-label="Refresh bookings" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <div className="admin-filters">
        <div className="input-icon admin-search">
          <Search size={18} />
          <input type="search" placeholder="Search name, email, reference, GCash ref…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search bookings" />
        </div>
        <select value={service} onChange={(event) => setService(event.target.value)} aria-label="Filter by service">
          <option value="all">All services</option>
          {SERVICES.map((entry) => (
            <option key={entry.id} value={entry.title}>
              {entry.title}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort bookings">
          <option value="newest">Newest requests</option>
          <option value="upcoming">Upcoming shoots only</option>
          <option value="shoot-asc">Shoot date, earliest</option>
          <option value="shoot-desc">Shoot date, latest</option>
        </select>
      </div>

      <div className="chip-row" role="group" aria-label="Filter by status">
        <button type="button" className={`chip chip-sm ${status === 'all' ? 'is-active' : ''}`} onClick={() => setStatus('all')} aria-pressed={status === 'all'}>
          All <span className="chip-count">{counts.all}</span>
        </button>
        {BOOKING_STATUSES.map((entry) => (
          <button
            key={entry.value}
            type="button"
            className={`chip chip-sm ${status === entry.value ? 'is-active' : ''}`}
            onClick={() => setStatus(entry.value)}
            aria-pressed={status === entry.value}
          >
            {entry.label} <span className="chip-count">{counts[entry.value]}</span>
          </button>
        ))}
      </div>

      {state === 'loading' && (
        <div className="loading-row">
          <LoaderCircle size={20} className="spin" /> Loading bookings…
        </div>
      )}
      {state === 'error' && (
        <div className="notice notice-danger">
          Bookings could not be loaded. <button type="button" className="btn-link" onClick={() => void onReload()}>Try again</button>
        </div>
      )}

      {state === 'ready' && view === 'list' && (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Inbox size={36} />
              <h3>No bookings match</h3>
              <p>Try a different status, service or search.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Client</th>
                    <th scope="col">Service</th>
                    <th scope="col">Shoot</th>
                    <th scope="col" className="num">Total</th>
                    <th scope="col">Payment</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((booking) => {
                    const step = NEXT_STEP[booking.status];
                    // Only offer "Mark done" once the shoot date has arrived.
                    const next = step && (step.status !== 'completed' || (booking.date && booking.date <= todayKey())) ? step : undefined;
                    return (
                      <tr key={booking.id}>
                        <td data-label="Client">
                          <button type="button" className="cell-main" onClick={() => setOpenId(booking.id)}>
                            <strong>{booking.fullName}</strong>
                            <span className="mono">{booking.reference}</span>
                          </button>
                        </td>
                        <td data-label="Service">{booking.service}</td>
                        <td data-label="Shoot">
                          <span className="cell-stack">
                            <span>{formatDateShort(booking.date)}</span>
                            <span className="muted">
                              {formatTime(booking.startTime)} · {booking.durationLabel}
                            </span>
                          </span>
                        </td>
                        <td data-label="Total" className="num">
                          {formatPeso(booking.totalAmount)}
                        </td>
                        <td data-label="Payment">
                          <span className={`badge badge-${paymentTone(booking.paymentStatus)}`}>{paymentLabel(booking.paymentStatus)}</span>
                        </td>
                        <td data-label="Status">
                          <span className={`badge badge-${statusTone(booking.status)}`}>{statusLabel(booking.status)}</span>
                        </td>
                        <td className="cell-actions">
                          {next && (
                            <button type="button" className="btn btn-outline btn-xs" onClick={() => setQuick({ booking, status: next.status })}>
                              {next.label}
                            </button>
                          )}
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setOpenId(booking.id)}>
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pageCount > 1 && (
            <nav className="pager" aria-label="Bookings pages">
              <button type="button" className="icon-btn" disabled={page === 0} onClick={() => setPage((value) => value - 1)} aria-label="Previous page">
                <ChevronLeft size={18} />
              </button>
              <span>
                Page {page + 1} of {pageCount} · {filtered.length} bookings
              </span>
              <button type="button" className="icon-btn" disabled={page >= pageCount - 1} onClick={() => setPage((value) => value + 1)} aria-label="Next page">
                <ChevronRight size={18} />
              </button>
            </nav>
          )}
        </>
      )}

      {state === 'ready' && view === 'calendar' && <BookingMonth bookings={filtered} onOpen={setOpenId} />}

      {openBooking && (
        <BookingDetail
          booking={openBooking}
          canDelete={user.role === 'superadmin' || user.role === 'admin'}
          onClose={() => setOpenId(null)}
          onSaved={onReplace}
          onDeleted={(id) => {
            onRemove(id);
            setOpenId(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(quick)}
        title={quick?.status === 'confirmed' ? 'Confirm this booking?' : 'Mark this shoot as done?'}
        message={
          quick
            ? quick.status === 'confirmed'
              ? `${quick.booking.fullName} · ${quick.booking.service} on ${quick.booking.dateDisplay}. This marks the GCash downpayment as verified and emails the client.`
              : `${quick.booking.fullName} · ${quick.booking.service} on ${quick.booking.dateDisplay}. An official receipt number is issued and photo status starts at Editing.`
            : ''
        }
        confirmLabel={quick?.status === 'confirmed' ? 'Confirm booking' : 'Mark done'}
        onConfirm={runQuick}
        onCancel={() => setQuick(null)}
      />
    </section>
  );
}

function BookingMonth({ bookings, onOpen }: { bookings: NormalizedBooking[]; onOpen: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDate = useMemo(() => {
    const map: Record<string, NormalizedBooking[]> = {};
    bookings.forEach((booking) => {
      if (!booking.date) return;
      (map[booking.date] ||= []).push(booking);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [bookings]);

  const cells = useMemo(() => {
    const first = new Date(cursor);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [cursor]);

  const today = todayKey();
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const shift = (delta: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const inMonthCount = Object.keys(byDate).filter((key) => key.startsWith(toDateKey(cursor).slice(0, 7))).reduce((sum, key) => sum + byDate[key].length, 0);

  return (
    <div className="admin-card admin-month">
      <div className="admin-month-head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <div>
          <strong>{monthLabel}</strong>
          <span>{inMonthCount} bookings shown</span>
        </div>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="admin-month-grid" role="grid" aria-label={monthLabel}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="admin-month-dow" role="columnheader">
            {day}
          </div>
        ))}
        {cells.map((date) => {
          const key = toDateKey(date);
          const items = byDate[key] || [];
          const outside = date.getMonth() !== cursor.getMonth();
          return (
            <div key={key} className={`admin-month-cell ${outside ? 'is-outside' : ''} ${key === today ? 'is-today' : ''}`} role="gridcell">
              <span className="admin-month-num">{date.getDate()}</span>
              {items.slice(0, 3).map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  className={`month-pill tone-${statusTone(booking.status)}`}
                  onClick={() => onOpen(booking.id)}
                  title={`${formatTime(booking.startTime)} ${booking.fullName} · ${booking.service} · ${statusLabel(booking.status)}`}
                >
                  <span className="month-pill-time">{formatTime(booking.startTime).replace(':00', '')}</span>
                  <span className="month-pill-name">{booking.fullName}</span>
                </button>
              ))}
              {items.length > 3 && <span className="month-more">+{items.length - 3} more</span>}
            </div>
          );
        })}
      </div>
      <div className="calendar-legend admin-legend">
        {BOOKING_STATUSES.map((entry) => (
          <span key={entry.value}>
            <i className={`legend-dot tone-${entry.tone}`} /> {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
