import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clock3, Trash2 } from 'lucide-react';
import { askConfirm } from '../../../lib/confirm';
import { supabase } from '../../../lib/supabase';
import { formatDay, formatTimeRange, rpc, useResource, useUnsaved } from '../../../lib/studio';
import AvailabilityTab from '../AvailabilityTab';
import { todayKey } from '../shared';
import { EmptyState, ErrorBox, PageHead, type Row } from './ui';

const SETTINGS: [string, string, 'time' | 'number', string][] = [
  ['opens_at', 'Opening time', 'time', 'Earliest start clients can book.'],
  ['closes_at', 'Closing time', 'time', 'Sessions must end by this time.'],
  ['buffer_before', 'Setup / travel before', 'number', 'Minutes kept free before each session.'],
  ['buffer_after', 'Wrap-up / travel after', 'number', 'Minutes kept free after each session.'],
  ['max_hours', 'Longest session', 'number', 'Hours.'],
  ['lead_days', 'Book at least', 'number', 'Days ahead of the shoot.'],
  ['delivery_days', 'Default gallery delivery', 'number', 'Days after the shoot.'],
  ['owner_notice_hours', 'Owner email after', 'number', 'Hours a future pending booking may remain unopened. Emails go to tutokpitikstudios@gmail.com, at most once per 24 hours, until an admin opens it. Checks run every 15 minutes.'],
  ['review_hours', 'Pending review target', 'number', 'Hours before a pending booking is flagged as late.'],
];

export default function ScheduleView({ revision }: { revision: number }) {
  const today = todayKey();
  const { data, error, refresh } = useResource(async () => {
    const [settings, blocks] = await Promise.all([
      supabase.from('studio_settings').select('*').single(),
      supabase.from('studio_time_blocks').select('*').gte('block_date', today).order('block_date').limit(200),
    ]);
    if (settings.error || blocks.error) throw settings.error || blocks.error;
    return { settings: settings.data as Row, blocks: blocks.data as Row[] };
  }, [revision]);
  const [draft, setDraft] = useState<Row | null>(null);
  const [dirty, setDirty] = useState(false);
  const [block, setBlock] = useState({ date: '', start: '08:00', end: '12:00', reason: '' });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  useUnsaved(dirty);

  useEffect(() => {
    if (data && !dirty) setDraft(data.settings);
  }, [data, dirty]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setFailure('');
    try {
      await fn();
      setDirty(false);
      await refresh();
      toast.success(message);
      return true;
    } catch (e) {
      setFailure((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addBlock = async () => {
    if (!block.date) return setFailure('Choose the date to block.');
    if (!block.start || !block.end || block.end <= block.start) return setFailure('The end time must be after the start time.');
    const ok = await run(() => rpc('studio_time_block', { p_date: block.date, p_start: block.start, p_end: block.end, p_reason: block.reason }), 'Time blocked');
    if (ok) setBlock({ date: '', start: '08:00', end: '12:00', reason: '' });
  };

  const removeBlock = async (b: Row) => {
    const ok = await askConfirm({
      title: 'Open this time again?',
      message: `${formatDay(b.block_date)}, ${formatTimeRange(b.start_time, b.end_time)} will be bookable again.`,
      confirmLabel: 'Remove block',
    });
    if (ok) await run(() => rpc('studio_time_block', { p_date: b.block_date, p_start: b.start_time, p_end: b.end_time, p_reason: '', p_remove: b.id }), 'Block removed');
  };

  return (
    <>
      <PageHead eyebrow="When clients can book" title="Availability" description="One studio session runs at a time. Block days or hours you can’t shoot, and set the rules every new booking follows." />
      <ErrorBox error={error || failure} />

      <AvailabilityTab embedded />

      <div className="ops-grid">
        <section className="ops-panel" aria-labelledby="ops-partial-title">
          <h2 id="ops-partial-title">Block part of a day</h2>
          <p className="ops-muted">For appointments or travel. The rest of the day stays bookable.</p>
          <fieldset disabled={busy} className="ops-fields ops-fields-2">
            <label className="ops-span-2">
              Date
              <input type="date" min={today} value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} />
            </label>
            <label>
              From
              <input type="time" value={block.start} onChange={(e) => setBlock({ ...block, start: e.target.value })} />
            </label>
            <label>
              Until
              <input type="time" value={block.end} onChange={(e) => setBlock({ ...block, end: e.target.value })} />
            </label>
            <label className="ops-span-2">
              Internal reason <span className="optional">(not shown to clients)</span>
              <input value={block.reason} maxLength={500} placeholder="e.g. Equipment pickup" onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
            </label>
            <div className="ops-span-2">
              <button type="button" className="btn btn-primary" onClick={() => void addBlock()}>
                Block this time
              </button>
            </div>
          </fieldset>
          <h3>Upcoming partial blocks</h3>
          {data?.blocks.length ? (
            <ul className="ops-block-list">
              {data.blocks.map((b) => (
                <li key={b.id}>
                  <Clock3 size={18} aria-hidden="true" />
                  <span>
                    <strong>{formatDay(b.block_date)}</strong>
                    <small>
                      {formatTimeRange(b.start_time, b.end_time)}
                      {b.reason ? ` · ${b.reason}` : ''}
                    </small>
                  </span>
                  <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" disabled={busy} aria-label={`Remove block on ${formatDay(b.block_date)}`} onClick={() => void removeBlock(b)}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No partial blocks">Every open day is bookable during working hours.</EmptyState>
          )}
        </section>

        <section className="ops-panel" aria-labelledby="ops-rules-title">
          <h2 id="ops-rules-title">Working hours and booking rules</h2>
          <p className="ops-muted">Buffers apply to new reservations. Existing bookings keep the buffers they were booked with.</p>
          {draft && (
            <fieldset disabled={busy} className="ops-fields ops-fields-2">
              {SETTINGS.map(([key, title, type, hint]) => (
                <label key={key}>
                  {title}
                  <input
                    type={type}
                    min={type === 'number' ? (key === 'owner_notice_hours' ? 1 : 0) : undefined}
                    max={key === 'owner_notice_hours' ? 168 : undefined}
                    value={draft[key] ?? ''}
                    onChange={(e) => {
                      setDirty(true);
                      setDraft({ ...draft, [key]: type === 'number' ? Number(e.target.value) : e.target.value });
                    }}
                  />
                  <small className="ops-hint">{hint}</small>
                </label>
              ))}
              <div className="ops-span-2 ops-form-actions">
                <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => void run(() => rpc('studio_schedule_settings', { p_data: draft }), 'Booking rules saved')}>
                  Save booking rules
                </button>
                {dirty && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setDirty(false);
                      setDraft(data?.settings || null);
                    }}
                  >
                    Undo changes
                  </button>
                )}
              </div>
            </fieldset>
          )}
        </section>
      </div>
    </>
  );
}
