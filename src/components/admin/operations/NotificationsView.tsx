import { useState } from 'react';
import { toast } from 'sonner';
import { Bell, CheckCheck, MailCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatStamp, label, rpc, useResource } from '../../../lib/studio';
import { EmptyState, ErrorBox, Loading, PageHead, Pagination, StatusBadge, type OpenBooking, type Row } from './ui';

const PAGE_SIZE = 50;
const emailTone = (n: Row) => (n.state === 'failed' || ['bounced', 'failed', 'suppressed'].includes(n.delivery_state) ? 'danger' : n.delivery_state === 'delivered' ? 'success' : n.state === 'review' ? 'warning' : 'neutral');

export default function NotificationsView({ revision, admin, initialMode = 'notifications', onOpen, onRead }: { revision: number; admin: boolean; initialMode?: 'notifications' | 'emails'; onOpen: OpenBooking; onRead: () => void }) {
  const [mode, setMode] = useState<'notifications' | 'emails'>(admin ? initialMode : 'notifications');
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const { data, error: loadError, refresh } = useResource<Row[]>(async () => {
    if (mode === 'emails') return rpc('studio_email_history', { p_page: page });
    const { data, error } = await supabase
      .from('studio_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    return data;
  }, [mode, page, revision]);

  const unread = mode === 'notifications' ? (data || []).filter((n) => !n.read_at).length : 0;
  const switchMode = (next: 'notifications' | 'emails') => {
    setMode(next);
    setPage(0);
  };
  const markAll = () =>
    void rpc('studio_mark_read')
      .then(async () => {
        await refresh();
        onRead();
      })
      .catch((e) => setError(e.message));

  return (
    <>
      <PageHead
        eyebrow="Stay in the loop"
        title="Notifications"
        description={mode === 'emails' ? '“Sent” means the email provider accepted it. “Delivered” needs a signed delivery event from the provider.' : 'Booking updates for you, newest first.'}
        actions={
          mode === 'notifications' && unread > 0 ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={markAll}>
              <CheckCheck size={16} aria-hidden="true" /> Mark all as read
            </button>
          ) : undefined
        }
      />
      {admin && (
        <div className="ops-segmented ops-segmented-lg" role="group" aria-label="Notification type">
          <button type="button" aria-pressed={mode === 'notifications'} className={mode === 'notifications' ? 'is-active' : ''} onClick={() => switchMode('notifications')}>
            Your updates
          </button>
          <button type="button" aria-pressed={mode === 'emails'} className={mode === 'emails' ? 'is-active' : ''} onClick={() => switchMode('emails')}>
            Email delivery
          </button>
        </div>
      )}
      <ErrorBox error={error || loadError} />
      <section className="ops-panel ops-feed">
        {!data ? (
          !loadError && <Loading />
        ) : data.length === 0 ? (
          mode === 'emails' ? (
            <EmptyState icon={MailCheck} title="No booking emails yet">
              Confirmation, reminder and delivery emails will be listed here.
            </EmptyState>
          ) : (
            <EmptyState icon={Bell} title="You’re all caught up">
              New payments, requests and messages on your bookings will appear here.
            </EmptyState>
          )
        ) : (
          data.map((n) => (
            <article className={`ops-entry ${mode === 'notifications' && !n.read_at ? 'is-unread' : ''}`} key={n.id}>
              <div className="ops-entry-head">
                <strong>{mode === 'emails' ? label(n.kind) : n.title}</strong>
                {mode === 'emails' ? (
                  <StatusBadge tone={emailTone(n)}>
                    {label(n.state)} · {label(n.delivery_state)}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone={n.read_at ? 'neutral' : 'info'}>{n.read_at ? 'Read' : 'New'}</StatusBadge>
                )}
              </div>
              <small>
                {formatStamp(n.created_at)}
                {mode === 'emails' && n.attempts ? ` · ${n.attempts} ${n.attempts === 1 ? 'attempt' : 'attempts'}` : ''}
              </small>
              {n.last_error && <p className="ops-error-text">{n.last_error}</p>}
              <div className="ops-entry-actions">
                {n.booking_id && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (mode === 'notifications' && !n.read_at) void rpc('studio_mark_read', { p_id: n.id }).then(onRead).catch(() => undefined);
                      onOpen(n.booking_id);
                    }}
                  >
                    Open booking
                  </button>
                )}
                {mode === 'emails' && n.state === 'failed' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      void rpc('studio_retry_email', { p_id: n.id })
                        .then(() => {
                          toast.success('Queued for retry');
                          void refresh();
                        })
                        .catch((e) => setError(e.message))
                    }
                  >
                    Retry email
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
      <Pagination page={page} hasNext={(data?.length || 0) >= PAGE_SIZE} onPage={setPage} />
    </>
  );
}
