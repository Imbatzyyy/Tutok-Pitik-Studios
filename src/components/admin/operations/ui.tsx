import type { ReactNode } from 'react';
import { ChevronRight, LoaderCircle, type LucideIcon } from 'lucide-react';
import {
  bookingRef,
  dateParts,
  formatDayShort,
  formatTimeRange,
  galleryText,
  galleryTone,
  label,
  money,
  nextSteps,
  paymentText,
  paymentTone,
  reservationTone,
  type BookingTab,
  type Tone,
} from '../../../lib/studio';

export { nextSteps, type BookingTab };
export type Row = Record<string, any>;
export type OpenBooking = (id: string, tab?: BookingTab) => void;

export const ErrorBox = ({ error }: { error?: string | null }) =>
  error ? (
    <p className="notice notice-danger" role="alert">
      {error}
    </p>
  ) : null;

export function PageHead({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ops-page-head">
      <div>
        {eyebrow && <p className="studio-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="ops-page-lead">{description}</p>}
      </div>
      {actions && <div className="ops-page-actions">{actions}</div>}
    </header>
  );
}

export const StatusBadge = ({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) => <span className={`ops-badge ops-tone-${tone}`}>{children}</span>;

export const Dot = ({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) => <span className={`ops-dot ops-tone-${tone}`}>{children}</span>;

export function Loading({ children = 'Loading…' }: { children?: ReactNode }) {
  return (
    <p className="ops-loading" role="status">
      <LoaderCircle size={18} className="spin" /> {children}
    </p>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="ops-empty">
      {Icon && <Icon size={26} aria-hidden="true" />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Pagination({ page, pageCount, hasNext, onPage }: { page: number; pageCount?: number; hasNext: boolean; onPage: (page: number) => void }) {
  if (page === 0 && !hasNext) return null;
  return (
    <nav className="ops-pagination" aria-label="Pages">
      <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page + 1}
        {pageCount ? ` of ${pageCount}` : ''}
      </span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={!hasNext} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export function DateTile({ date }: { date: unknown }) {
  const parts = dateParts(date);
  return (
    <span className="ops-date" aria-hidden="true">
      <small>{parts.weekday}</small>
      <strong>{parts.day}</strong>
      <small>{parts.month}</small>
    </span>
  );
}

function BookingSummary({ b }: { b: Row }) {
  return (
    <>
      <DateTile date={b.booking_date} />
      <span className="ops-booking-main">
        <strong>{b.full_name || 'Client'}</strong>
        <small>
          {b.service} · {formatTimeRange(b.start_time, b.end_time)}
        </small>
        <small className="ops-ref">
          {bookingRef(b.id)}
          {b.needs_information ? ' · Waiting for client' : ''}
        </small>
      </span>
    </>
  );
}

export function BookingRows({ rows, onOpen, empty }: { rows: Row[]; onOpen: OpenBooking; empty?: ReactNode }) {
  if (!rows.length) {
    return <div className="ops-booking-list">{empty || <EmptyState title="Nothing here right now">Try another view or search.</EmptyState>}</div>;
  }
  return (
    <ul className="ops-booking-list">
      {rows.map((b) => (
        <li key={b.id}>
          <button type="button" className="ops-booking-row" onClick={() => onOpen(b.id)} aria-label={`Open booking for ${b.full_name}, ${formatDayShort(b.booking_date)}`}>
            <BookingSummary b={b} />
            <span className="ops-booking-status">
              <StatusBadge tone={reservationTone(b.status)}>{label(b.status)}</StatusBadge>
              <span className="ops-dots">
                <Dot tone={paymentTone(b.payment_state)}>{paymentText(b.payment_state)}</Dot>
                <Dot tone={galleryTone(b.gallery_status)}>{galleryText(b.gallery_status)}</Dot>
              </span>
              {b.delivery_due && b.status !== 'cancelled' && <small>Delivery due {formatDayShort(b.delivery_due)}</small>}
            </span>
            <span className="ops-row-money">
              <strong>{money(b.total_price)}</strong>
              <small>
                Open <ChevronRight size={14} aria-hidden="true" />
              </small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Overview queue: each booking with the one thing it needs next, one tap away. */
export function ActionRows({ rows, onOpen }: { rows: Row[]; onOpen: OpenBooking }) {
  return (
    <ul className="ops-booking-list ops-action-list">
      {rows.map((b) => {
        const steps = nextSteps(b);
        const first = steps[0];
        return (
          <li key={b.id} className="ops-action-row">
            <button type="button" className="ops-action-open" onClick={() => onOpen(b.id)} aria-label={`Open booking for ${b.full_name}, ${formatDayShort(b.booking_date)}`}>
              <BookingSummary b={b} />
              <span className="ops-booking-status">
                <StatusBadge tone={reservationTone(b.status)}>{label(b.status)}</StatusBadge>
                <span className="ops-dots">
                  {steps.length ? steps.map((step) => <Dot key={step.text} tone={step.tone}>{step.text}</Dot>) : <Dot tone="success">On track</Dot>}
                </span>
              </span>
            </button>
            {first && (
              <button type="button" className="btn btn-secondary btn-sm ops-action-btn" onClick={() => onOpen(b.id, first.tab)}>
                {first.action}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Small accessible bar chart: one series, one hue, hover or focus a bar for its value. */
export function BarChart({ data, format = (value) => String(value), title }: { data: { label: string; value: number }[]; format?: (value: number) => string; title: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <figure className="ops-chart">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="ops-chart-plot" role="list">
        {data.map((item) => (
          <div key={item.label} className="ops-chart-col" role="listitem" tabIndex={0} aria-label={`${item.label}: ${format(item.value)}`}>
            <span className="ops-chart-tip">{format(item.value)}</span>
            <span className="ops-chart-bar" style={{ height: `${Math.max(2, (item.value / max) * 100)}%` }} />
            <span className="ops-chart-label">{item.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Horizontal bars for a category mix, labelled directly. */
export function MixBars({ data, format = (value) => String(value) }: { data: { label: string; value: number; note?: string }[]; format?: (value: number) => string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <ul className="ops-mix">
      {data.map((item) => (
        <li key={item.label}>
          <span className="ops-mix-head">
            <span>{item.label}</span>
            <strong>{format(item.value)}</strong>
          </span>
          <span className="ops-mix-track" aria-hidden="true">
            <span className="ops-mix-fill" style={{ width: `${Math.max(1.5, (item.value / max) * 100)}%` }} />
          </span>
          {item.note && <small>{item.note}</small>}
        </li>
      ))}
    </ul>
  );
}
