import { useMemo, useState, type ReactNode } from 'react';
import { CalendarCheck, Hourglass, LoaderCircle, RefreshCw, UserPlus, Wallet } from 'lucide-react';
import { statusLabel, statusTone, type NormalizedBooking } from '../../lib/bookings';
import { formatDateShort, formatPeso, formatTime } from '../../lib/format';
import { SERVICES } from '../../content/site';
import { addDaysKey, todayKey, type AdminUser } from './shared';
import type { LoadState } from './AdminDashboard';

interface OverviewTabProps {
  bookings: NormalizedBooking[];
  bookingsState: LoadState;
  users: AdminUser[];
  onOpenBooking: (id: string) => void;
  onRefresh: () => void;
}

const MONTHS_SHOWN = 6;

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export default function OverviewTab({ bookings, bookingsState, users, onOpenBooking, onRefresh }: OverviewTabProps) {
  const today = todayKey();
  const in30 = addDaysKey(30);

  const stats = useMemo(() => {
    const live = bookings.filter((booking) => booking.status !== 'cancelled');
    const completed = bookings.filter((booking) => booking.status === 'completed');
    const revenue = completed.reduce((sum, booking) => sum + booking.totalAmount, 0);
    const pending = bookings.filter((booking) => booking.status === 'pending');
    const upcoming = bookings
      .filter((booking) => booking.status === 'confirmed' && booking.date >= today && booking.date <= in30)
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    const bookedValue = bookings
      .filter((booking) => booking.status === 'confirmed' && booking.date >= today)
      .reduce((sum, booking) => sum + booking.totalAmount, 0);
    const thisMonth = monthKey(new Date());
    const newCustomers = users.filter((user) => user.role === 'customer' && (user.joinDate || '').startsWith(thisMonth)).length;
    const customers = users.filter((user) => user.role === 'customer').length;
    return { live, completed, revenue, pending, upcoming, bookedValue, newCustomers, customers };
  }, [bookings, users, today, in30]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: MONTHS_SHOWN }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - index), 1);
      return {
        key: monthKey(date),
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        long: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        count: 0,
        value: 0,
      };
    });
    bookings.forEach((booking) => {
      if (booking.status === 'cancelled') return;
      const bucket = buckets.find((entry) => (booking.createdAt || '').startsWith(entry.key));
      if (bucket) {
        bucket.count += 1;
        bucket.value += booking.totalAmount;
      }
    });
    return buckets;
  }, [bookings]);

  const serviceMix = useMemo(() => {
    const counts = SERVICES.map((service) => ({
      title: service.title,
      count: stats.live.filter((booking) => booking.service.toLowerCase().startsWith(service.title.toLowerCase())).length,
    }));
    const known = counts.reduce((sum, entry) => sum + entry.count, 0);
    const other = stats.live.length - known;
    if (other > 0) counts.push({ title: 'Other', count: other });
    return counts.sort((a, b) => b.count - a.count);
  }, [stats.live]);

  if (bookingsState === 'loading') {
    return (
      <div className="loading-row">
        <LoaderCircle size={20} className="spin" /> Loading dashboard…
      </div>
    );
  }

  return (
    <section className="admin-section" aria-labelledby="overview-title">
      <header className="admin-head">
        <div>
          <h1 id="overview-title">Overview</h1>
          <p>How the studio is doing, and what needs your attention.</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      {bookingsState === 'error' && (
        <div className="notice notice-danger">Bookings could not be loaded. Check your connection, then refresh.</div>
      )}

      <div className="kpi-grid">
        <Kpi icon={<Hourglass size={18} />} label="Needs review" value={String(stats.pending.length)} hint="Pending bookings with a payment to check" tone={stats.pending.length ? 'warning' : undefined} />
        <Kpi icon={<CalendarCheck size={18} />} label="Shoots in the next 30 days" value={String(stats.upcoming.length)} hint={`${formatPeso(stats.bookedValue)} in confirmed bookings ahead`} />
        <Kpi icon={<Wallet size={18} />} label="Revenue from completed shoots" value={formatPeso(stats.revenue)} hint={`${stats.completed.length} completed ${stats.completed.length === 1 ? 'booking' : 'bookings'}`} />
        <Kpi icon={<UserPlus size={18} />} label="Customers" value={String(stats.customers)} hint={`${stats.newCustomers} joined this month`} />
      </div>

      <div className="admin-grid-2">
        <div className="admin-card">
          <div className="admin-card-head">
            <h2>Booking requests per month</h2>
            <span>Last {MONTHS_SHOWN} months · excludes cancelled</span>
          </div>
          <MonthlyBars data={monthly} />
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <h2>Bookings by service</h2>
            <span>All time · excludes cancelled</span>
          </div>
          <ServiceBars data={serviceMix} total={stats.live.length} />
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="admin-card">
          <div className="admin-card-head">
            <h2>Waiting for review</h2>
            <span>{stats.pending.length} pending</span>
          </div>
          <BookingList items={stats.pending.slice(0, 6)} empty="Nothing waiting. Every request has been handled." onOpen={onOpenBooking} />
        </div>
        <div className="admin-card">
          <div className="admin-card-head">
            <h2>Upcoming shoots</h2>
            <span>Next 30 days</span>
          </div>
          <BookingList items={stats.upcoming.slice(0, 6)} empty="No confirmed shoots in the next 30 days." onOpen={onOpenBooking} />
        </div>
      </div>
    </section>
  );
}

function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone?: 'warning' }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ''}`}>
      <span className="kpi-label">
        {icon}
        {label}
      </span>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-hint">{hint}</span>
    </div>
  );
}

function BookingList({ items, empty, onOpen }: { items: NormalizedBooking[]; empty: string; onOpen: (id: string) => void }) {
  if (items.length === 0) return <p className="admin-empty-line">{empty}</p>;
  return (
    <ul className="mini-list">
      {items.map((booking) => (
        <li key={booking.id}>
          <button type="button" onClick={() => onOpen(booking.id)}>
            <span className="mini-date">
              <strong>{booking.date ? new Date(`${booking.date}T00:00:00`).getDate() : '–'}</strong>
              <span>{booking.date ? new Date(`${booking.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' }) : ''}</span>
            </span>
            <span className="mini-body">
              <strong>{booking.fullName}</strong>
              <span>
                {booking.service} · {formatTime(booking.startTime)} · {formatDateShort(booking.date)}
              </span>
            </span>
            <span className={`badge badge-${statusTone(booking.status)}`}>{statusLabel(booking.status)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface MonthDatum {
  key: string;
  label: string;
  long: string;
  count: number;
  value: number;
}

function MonthlyBars({ data }: { data: MonthDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...data.map((entry) => entry.count));
  const step = max <= 8 ? 2 : max <= 20 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => index * step);

  const width = 520;
  const height = 220;
  const pad = { top: 16, right: 8, bottom: 28, left: 32 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / data.length;
  const barW = Math.min(40, slot * 0.56);
  const y = (value: number) => pad.top + plotH - (value / top) * plotH;

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Booking requests per month">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? 'chart-axis' : 'chart-grid'} />
            <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="chart-tick">
              {tick}
            </text>
          </g>
        ))}
        {data.map((entry, index) => {
          const x = pad.left + slot * index + (slot - barW) / 2;
          const barTop = y(entry.count);
          const h = Math.max(0, pad.top + plotH - barTop);
          const r = Math.min(4, h / 2);
          return (
            <g key={entry.key}>
              {h > 0 && (
                <path
                  className={`chart-bar ${hover === index ? 'is-hover' : ''}`}
                  d={`M${x},${barTop + h} V${barTop + r} Q${x},${barTop} ${x + r},${barTop} H${x + barW - r} Q${x + barW},${barTop} ${x + barW},${barTop + r} V${barTop + h} Z`}
                />
              )}
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="chart-tick">
                {entry.label}
              </text>
              <rect
                x={pad.left + slot * index}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${entry.long}: ${entry.count} bookings, ${formatPeso(entry.value)}`}
              />
            </g>
          );
        })}
      </svg>
      {active && hover !== null && (
        <div className="chart-tooltip" style={{ left: `${((pad.left + slot * hover + slot / 2) / width) * 100}%` }} role="status">
          <strong>{active.long}</strong>
          <span>
            {active.count} {active.count === 1 ? 'booking' : 'bookings'}
          </span>
          <span>{formatPeso(active.value)} booked</span>
        </div>
      )}
      <table className="sr-only">
        <caption>Booking requests per month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Bookings</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.key}>
              <td>{entry.long}</td>
              <td>{entry.count}</td>
              <td>{formatPeso(entry.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServiceBars({ data, total }: { data: { title: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...data.map((entry) => entry.count));
  if (total === 0) return <p className="admin-empty-line">No bookings yet.</p>;
  return (
    <ul className="hbar-list">
      {data.map((entry) => (
        <li key={entry.title} title={`${entry.title}: ${entry.count} (${Math.round((entry.count / total) * 100)}%)`}>
          <div className="hbar-label">
            <span>{entry.title}</span>
            <strong>
              {entry.count}
              <small> · {Math.round((entry.count / total) * 100)}%</small>
            </strong>
          </div>
          <div className="hbar-track">
            {entry.count > 0 && <div className="hbar-fill" style={{ width: `${(entry.count / max) * 100}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
