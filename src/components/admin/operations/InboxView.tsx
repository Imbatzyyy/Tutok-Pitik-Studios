import { useCallback, useEffect, useState } from 'react';
import { Inbox, Mail, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatStamp } from '../../../lib/studio';
import { EmptyState, ErrorBox, Loading, PageHead, StatusBadge, type Row } from './ui';

const SEEN_KEY = 'tps-studio-inbox-seen';

/** When this browser last opened Inquiries (a per-device convenience for the "new" badge). */
export const inboxSeenAt = () => {
  try {
    return localStorage.getItem(SEEN_KEY) || '';
  } catch {
    return '';
  }
};

export default function InboxView({ onSeen }: { onSeen: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [seenBefore] = useState(inboxSeenAt);

  const load = useCallback(async () => {
    setState('loading');
    const { data, error } = await supabase.from('contact_messages').select('id,name,email,message,created_at').order('created_at', { ascending: false }).limit(100);
    if (error) {
      setState('error');
      return;
    }
    setRows(data || []);
    setState('ready');
    try {
      localStorage.setItem(SEEN_KEY, new Date().toISOString());
    } catch {
      /* private mode: the badge simply stays */
    }
    onSeen();
  }, [onSeen]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHead
        eyebrow="Conversations"
        title="Inquiries"
        description="Messages sent from the website’s contact form. Replies open in your email app. Messenger and Gmail conversations stay in their own apps."
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden="true" /> Refresh
          </button>
        }
      />
      {state === 'error' && <ErrorBox error="Inquiries couldn’t be loaded. Please try again." />}
      {state === 'loading' ? (
        <Loading>Loading inquiries…</Loading>
      ) : rows.length ? (
        <ul className="ops-inquiries">
          {rows.map((r) => (
            <li key={r.id} className="ops-panel ops-inquiry">
              <div className="ops-entry-head">
                <strong>{r.name || 'Website visitor'}</strong>
                {seenBefore && r.created_at > seenBefore && <StatusBadge tone="info">New</StatusBadge>}
              </div>
              <small className="ops-muted">
                {r.email} · {formatStamp(r.created_at)}
              </small>
              <p className="ops-whitespace">{r.message}</p>
              <a className="btn btn-secondary btn-sm" href={`mailto:${r.email}?subject=${encodeURIComponent('Re: your message to Tutok Pitik Studios')}`}>
                <Mail size={16} aria-hidden="true" /> Reply by email
              </a>
            </li>
          ))}
        </ul>
      ) : (
        state === 'ready' && (
          <section className="ops-panel">
            <EmptyState icon={Inbox} title="All caught up">
              New messages from the website’s contact form will appear here.
            </EmptyState>
          </section>
        )
      )}
    </>
  );
}
