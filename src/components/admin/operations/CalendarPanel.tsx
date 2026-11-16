import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatClock, formatDay, rpc, useResource } from '../../../lib/studio';
import { todayKey } from '../shared';
import { BookingRows, ErrorBox, type OpenBooking, type Row } from './ui';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarPanel({ revision, onOpen }: { revision: number; onOpen: OpenBooking }) {
  const today = todayKey();
  const [anchor, setAnchor] = useState(today);
  const [mode, setMode] = useState<'month' | 'week' | 'day'>('month');
  const [selected, setSelected] = useState(today);
  const [mine, setMine] = useState(false);

  const date = new Date(`${anchor}T12:00:00`);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  if (mode === 'week') {
    first.setTime(date.getTime());
    first.setDate(date.getDate() - date.getDay());
  } else if (mode === 'day') first.setTime(date.getTime());
  else first.setDate(1 - first.getDay());
  const days = Array.from({ length: mode === 'month' ? 42 : mode === 'week' ? 7 : 1 }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    return keyOf(d);
  });
  const month = date.getMonth();

  const { data, error } = useResource<Row[]>(() => rpc('studio_calendar', { p_from: days[0], p_to: days[days.length - 1], p_mine: mine }), [days[0], days[days.length - 1], mine, revision]);

  const shift = (n: number) => {
    const d = new Date(date);
    if (mode === 'month') d.setMonth(d.getMonth() + n);
    else d.setDate(d.getDate() + n * (mode === 'week' ? 7 : 1));
    setAnchor(keyOf(d));
    setSelected(keyOf(d));
  };
  const periodLabel =
    mode === 'day' ? formatDay(anchor) : date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <section className="ops-panel ops-calendar-panel" aria-label="Studio calendar">
      <div className="ops-calendar-head">
        <div>
          <h2>{periodLabel}</h2>
          <p className="ops-muted">Manila time · tap a day to see its shoots</p>
        </div>
        <div className="ops-calendar-controls">
          <div className="ops-segmented" role="group" aria-label="Calendar view">
            {(['month', 'week', 'day'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={mode === value} className={mode === value ? 'is-active' : ''} onClick={() => setMode(value)}>
                {value === 'month' ? 'Month' : value === 'week' ? 'Week' : 'Day'}
              </button>
            ))}
          </div>
          <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous period">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setAnchor(today);
              setSelected(today);
            }}
          >
            Today
          </button>
          <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next period">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <label className="ops-check">
        <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
        Only my assignments
      </label>
      <ErrorBox error={error} />
      {mode !== 'day' && (
        <div className="ops-calendar">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
          {days.map((day) => {
            const rows = data?.filter((b) => b.booking_date === day) || [];
            const outside = mode === 'month' && Number(day.slice(5, 7)) - 1 !== month;
            const classes = [day === selected ? 'is-selected' : '', day === today ? 'is-today' : '', outside ? 'is-outside' : '', rows.length ? 'has-shoots' : ''].filter(Boolean).join(' ');
            return (
              <button key={day} type="button" className={classes} aria-pressed={day === selected} aria-label={`${formatDay(day)}, ${rows.length} ${rows.length === 1 ? 'shoot' : 'shoots'}`} onClick={() => setSelected(day)}>
                <strong>{Number(day.slice(8))}</strong>
                {rows.length > 0 && <small>{rows.length === 1 ? '1 shoot' : `${rows.length} shoots`}</small>}
                {rows.slice(0, 2).map((b) => (
                  <span key={b.id}>
                    {formatClock(b.start_time)} {b.full_name}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      )}
      <h3 className="ops-calendar-day">{formatDay(selected)}</h3>
      <BookingRows rows={data?.filter((b) => b.booking_date === selected) || []} onOpen={onOpen} empty={<p className="ops-muted ops-pad">No shoots on this day.</p>} />
    </section>
  );
}
