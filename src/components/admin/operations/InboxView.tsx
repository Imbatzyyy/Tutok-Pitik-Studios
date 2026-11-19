import { useCallback, useEffect, useState } from 'react';
import { Inbox, Mail, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatStamp } from '../../../lib/studio';
import { EmptyState, ErrorBox, Loading, PageHead, StatusBadge, type Row } from './ui';

export default function InboxView({ onSeen }: { onSeen: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [acting,setActing] = useState('');
  const [page,setPage] = useState(0);
  const pageSize = 40;
  const [issue,setIssue] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    const { data, error } = await supabase.from('contact_messages').select('id,name,email,reply_phone,hold_reference,message,created_at,service,preferred_date,inquiry_state,owner_id,owner:users!contact_messages_owner_id_fkey(full_name)').order('created_at', { ascending: false }).order('id', {ascending:false}).range(page*pageSize,(page+1)*pageSize);
    if (error) {
      setState('error');
      return;
    }
    setRows(data || []);
    setState('ready');

  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(id:string,state:string) {
    setActing(id);setIssue('');
    try {
      const {error}=await supabase.rpc('studio_handle_inquiry',{p_id:id,p_state:state});
      if(error)throw error;
      await load(); onSeen();
    } catch {setIssue('Could not update the inquiry. Please retry.');}
    finally {setActing('');}
  }
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
      {(page > 0 || rows.length > pageSize) && <nav aria-label="Inquiry pages"><button type="button" className="btn btn-secondary" disabled={!page} onClick={()=>setPage(n=>n-1)}>Previous</button> <button type="button" className="btn btn-secondary" disabled={rows.length<=pageSize} onClick={()=>setPage(n=>n+1)}>Next</button></nav>}
      {issue && <ErrorBox error={issue}/>}
      {state === 'error' && <ErrorBox error="Inquiries couldn’t be loaded. Please try again." />}
      {state === 'loading' ? (
        <Loading>Loading inquiries…</Loading>
      ) : rows.length ? (
        <ul className="ops-inquiries">
          {rows.slice(0,pageSize).map((r) => (
            <li key={r.id} className="ops-panel ops-inquiry">
              <div className="ops-entry-head">
                <strong>{r.name || 'Website visitor'}</strong>
                <StatusBadge tone="info">{r.inquiry_state}</StatusBadge>
              </div>
              <small className="ops-muted">
                {r.email} · {formatStamp(r.created_at)}
              </small>
              <p>{r.hold_reference && <strong>GCash reconciliation · </strong>}{r.service} {r.preferred_date} · {r.owner?.full_name || 'Unassigned'}</p>
              <p className="ops-whitespace">{r.message}</p>
              {r.reply_phone && <a className="btn btn-secondary btn-sm" href={'tel:'+r.reply_phone}>Call {r.reply_phone}</a>}
              <a className="btn btn-secondary btn-sm"  href={`mailto:${r.email}?subject=${encodeURIComponent('Re: your message to Tutok Pitik Studios')}`}>
                <Mail size={16} aria-hidden="true" /> Reply by email
              </a>
              {(['working','replied','booked','closed'] as const).map((state,i)=><button key={state} disabled={!!acting || state===r.inquiry_state} type="button" className="btn btn-ghost btn-sm" onClick={()=>update(r.id,state)}>{['Take ownership','Mark replied','Mark booked','Close'][i]}</button>)}
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
