import { useCallback, useEffect, useState } from 'react';
import { Clock3, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatStamp, label } from '../../../lib/studio';
import { EmptyState, ErrorBox, Loading, PageHead, type OpenBooking } from './ui';

type Activity = { id: number; occurred_at: string; actor_role: string; actor_name?: string | null; resource: string; record_id: string; action: string; status_before: string | null; status_after: string | null };

const RESOURCE_NAMES: Record<string, string> = {
  bookings: 'Booking',
  users: 'Account',
  portfolio_images: 'Portfolio photo',
  testimonials: 'Testimonial',
  blocked_dates: 'Blocked date',
  studio_settings: 'Booking rules',
  studio_time_blocks: 'Partial-day block',
};
const ACTIONS: Record<string, string> = { insert: 'created', delete: 'removed', update: 'updated', password_reset_sent: 'password reset sent', password_reset_failed: 'password reset failed' };

export default function ActivityView({ onOpen }: { onOpen: OpenBooking }) {
  const [rows, setRows] = useState<Activity[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    const { data, error } = await supabase.from('studio_activity').select('*').order('occurred_at', { ascending: false }).limit(100);
    if (error) {
      setState('error');
      return;
    }
    setRows((data as Activity[]) || []);
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHead
        eyebrow="What’s happening"
        title="Activity"
        description="The latest 100 recorded changes since this workspace launched. Earlier history is not filled in."
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden="true" /> Refresh
          </button>
        }
      />
      {state === 'error' && <ErrorBox error="Activity couldn’t be loaded. Please try again." />}
      <section className="ops-panel">
        {state === 'loading' ? (
          <Loading>Loading activity…</Loading>
        ) : rows.length ? (
          <ol className="studio-timeline">
            {rows.map((r) => {
              const who = r.actor_role === 'system' ? 'System' : r.actor_name || label(r.actor_role);
              const change = r.status_after && r.status_before !== r.status_after ? `${label(r.status_before) || 'New'} → ${label(r.status_after)}` : '';
              return (
                <li key={r.id}>
                  <span className="studio-timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>
                      {RESOURCE_NAMES[r.resource] || 'Studio record'} {ACTIONS[r.action] || label(r.action).toLowerCase()}
                    </strong>
                    <p>
                      {who}
                      {change ? ` · ${change}` : ''}
                    </p>
                    <time>{formatStamp(r.occurred_at)}</time>
                  </div>
                  {r.resource === 'bookings' && r.action !== 'delete' && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpen(r.record_id)}>
                      View booking
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          state === 'ready' && (
            <EmptyState icon={Clock3} title="A fresh start">
              New booking and studio changes will be recorded here.
            </EmptyState>
          )
        )}
      </section>
    </>
  );
}
