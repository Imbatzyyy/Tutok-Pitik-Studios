import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayState, earliestBookableDate, latestBookableDate, type AvailabilityState, type DayState } from '../lib/availability';
import { toDateKey } from '../lib/format';

interface BookingCalendarProps {
  value: string | null;
  onChange: (date: string) => void;
  availability: AvailabilityState;
  disabled?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATE_LABEL: Record<DayState, string> = {
  past: 'Not available',
  'out-of-range': 'Not open for booking yet',
  blocked: 'Unavailable',
  full: 'Fully booked',
  limited: 'Some times taken',
  open: 'Open',
};

export default function BookingCalendar({ value, onChange, availability, disabled }: BookingCalendarProps) {
  const first = earliestBookableDate();
  const last = latestBookableDate();
  const initial = value ? new Date(`${value}T00:00:00`) : first;
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const days = useMemo(() => {
    const start = new Date(view.year, view.month, 1);
    const count = new Date(view.year, view.month + 1, 0).getDate();
    const cells: ({ key: string; day: number; state: DayState } | null)[] = Array.from({ length: start.getDay() }, () => null);
    for (let day = 1; day <= count; day += 1) {
      const key = toDateKey(new Date(view.year, view.month, day));
      cells.push({ key, day, state: dayState(key, availability) });
    }
    return cells;
  }, [view, availability]);

  const openCount = days.filter((cell) => cell && (cell.state === 'open' || cell.state === 'limited')).length;
  const canPrev = new Date(view.year, view.month, 1) > new Date(first.getFullYear(), first.getMonth(), 1);
  const canNext = new Date(view.year, view.month + 1, 1) <= last;
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const move = (delta: number) =>
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <div className={`calendar ${disabled ? 'is-disabled' : ''}`}>
      <div className="calendar-head">
        <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(-1)} disabled={!canPrev} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <div className="calendar-title">
          <strong>{monthLabel}</strong>
          {availability.status === 'ready' && (
            <span className={openCount > 0 ? 'calendar-open' : 'calendar-none'}>
              {openCount > 0 ? `${openCount} ${openCount === 1 ? 'date' : 'dates'} still open` : 'No open dates this month'}
            </span>
          )}
          {availability.status === 'loading' && <span className="calendar-muted">Checking availability…</span>}
        </div>
        <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(1)} disabled={!canNext} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="calendar-grid" role="grid" aria-label={`Dates in ${monthLabel}`}>
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="calendar-weekday" role="columnheader">
            {weekday}
          </span>
        ))}
        {days.map((cell, index) =>
          cell ? (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              className={`calendar-day is-${cell.state} ${value === cell.key ? 'is-selected' : ''}`}
              disabled={disabled || !['open', 'limited'].includes(cell.state)}
              aria-pressed={value === cell.key}
              aria-label={`${new Date(`${cell.key}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: ${STATE_LABEL[cell.state]}`}
              title={availability.blocked[cell.key] && cell.state === 'blocked' ? 'Unavailable' : STATE_LABEL[cell.state]}
              onClick={() => onChange(cell.key)}
            >
              {cell.day}
            </button>
          ) : (
            <span key={`blank-${index}`} className="calendar-blank" aria-hidden="true" />
          )
        )}
      </div>

      <ul className="calendar-legend" aria-hidden="true">
        <li><span className="dot is-open" /> Open</li>
        <li><span className="dot is-limited" /> Some times taken</li>
        <li><span className="dot is-full" /> Booked / unavailable</li>
      </ul>
    </div>
  );
}
