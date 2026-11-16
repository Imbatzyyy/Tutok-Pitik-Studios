import { useState } from 'react';
import { Download, KeyRound, LaptopMinimal, ShieldCheck } from 'lucide-react';
import { askConfirm } from '../../../lib/confirm';
import { supabase } from '../../../lib/supabase';
import { download, formatStamp, label, rpc, useResource } from '../../../lib/studio';
import type { SessionUser } from '../../../lib/session';
import { EmptyState, ErrorBox, PageHead, StatusBadge, type Row } from './ui';

const healthTone = (state: string) => (['ok', 'healthy', 'success', 'passed'].includes(state) ? 'success' : ['failed', 'error', 'down'].includes(state) ? 'danger' : state === 'preview' ? 'neutral' : 'warning');

export default function SecurityView({ user, revision }: { user: SessionUser; revision: number }) {
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, error: loadError, refresh } = useResource<Row[]>(() => rpc('studio_sessions'), [revision]);
  const health = useResource<Row[]>(async () => {
    if (user.role === 'staff') return [];
    const { data, error } = await supabase.from('studio_operations').select('*').order('key');
    if (error) throw error;
    return data;
  }, [revision]);

  const makeCodes = async () => {
    const ok = await askConfirm({
      title: 'Create new recovery codes?',
      message: 'Any recovery codes you saved before will stop working.',
      confirmLabel: 'Create new codes',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const values = Array.from({ length: 8 }, () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (v) => v.toString(16).padStart(2, '0')).join(''));
      const hashes = await Promise.all(
        values.map(async (v) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))), (b) => b.toString(16).padStart(2, '0')).join(''))
      );
      await rpc('studio_recovery_codes', { p_hashes: hashes });
      setCodes(values);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (session: Row) => {
    const ok = await askConfirm({
      title: session.current ? 'Sign out of this device?' : 'End this session?',
      message: session.current ? 'This is the session you are using now. You will be signed out straight away.' : 'That device will lose access to the studio workspace immediately.',
      confirmLabel: session.current ? 'Sign out now' : 'End session',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await rpc('studio_revoke_session', { p_id: session.id });
      if (session.current) {
        await supabase.auth.signOut({ scope: 'local' });
        location.assign('/admin/login');
      } else await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <PageHead eyebrow="Keep the workspace safe" title="Security & health" description="Your sign-in protection, the devices signed in to your account, and the studio’s background checks." />
      <ErrorBox error={error || loadError} />
      <div className="ops-grid">
        <section className="ops-panel" aria-labelledby="ops-recovery-title">
          <h2 id="ops-recovery-title">
            <KeyRound size={18} aria-hidden="true" /> Authenticator recovery codes
          </h2>
          <p className="ops-muted">Signing in needs your password and a code from your authenticator app. If you lose your phone, one recovery code lets you set up a new authenticator. Each code works once.</p>
          {codes.length > 0 ? (
            <div className="ops-codes">
              <strong>Save these now. They won’t be shown again.</strong>
              <pre>{codes.join('\n')}</pre>
              <div className="ops-entry-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => download('tutok-studio-recovery-codes.txt', 'Keep these codes private. Each works once.\n\n' + codes.join('\n'))}>
                  <Download size={16} aria-hidden="true" /> Download codes
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCodes([])}>
                  I saved them · Hide codes
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void makeCodes()}>
              {busy ? 'Creating codes…' : 'Create eight new recovery codes'}
            </button>
          )}
        </section>

        <section className="ops-panel" aria-labelledby="ops-sessions-title">
          <h2 id="ops-sessions-title">
            <LaptopMinimal size={18} aria-hidden="true" /> Signed-in devices
          </h2>
          <p className="ops-muted">Workspace sessions end after eight hours. Ending one locks studio records on that device straight away.</p>
          {data?.length ? (
            <ul className="ops-session-list">
              {data.map((s) => (
                <li key={s.id}>
                  <span>
                    <strong>
                      {s.current ? 'This device' : 'Another device'} {s.current && <StatusBadge tone="success">Current</StatusBadge>}
                    </strong>
                    <small>Signed in {formatStamp(s.created_at)}</small>
                    <small>Ends {formatStamp(s.expires_at)}</small>
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void revoke(s)}>
                    {s.current ? 'Sign out' : 'End session'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ops-muted">{data ? 'No other active sessions.' : 'Loading…'}</p>
          )}
        </section>
      </div>

      {user.role !== 'staff' && (
        <section className="ops-panel" aria-labelledby="ops-health-title">
          <h2 id="ops-health-title">
            <ShieldCheck size={18} aria-hidden="true" /> Service health
          </h2>
          <ErrorBox error={health.error} />
          {health.data?.length === 0 && <EmptyState title="No checks yet">Backups and reminder checks report here after their first scheduled run.</EmptyState>}
          {health.data?.map((h) => {
            const overdue = Date.now() - new Date(h.checked_at).getTime() > 36 * 3600_000;
            return (
              <article className="ops-entry" key={h.key}>
                <div className="ops-entry-head">
                  <strong>{label(h.key)}</strong>
                  <StatusBadge tone={overdue ? 'warning' : healthTone(String(h.state))}>{label(h.state)}</StatusBadge>
                </div>
                <p>{h.detail}</p>
                <small>Last check {formatStamp(h.checked_at)} (Manila time)</small>
                {overdue && <p className="notice notice-warning">This check is overdue. Review the scheduled service.</p>}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
