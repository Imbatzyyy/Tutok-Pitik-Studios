import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { KeyRound, Search, UserPlus, Users } from 'lucide-react';
import { callEdge } from '../../../lib/api';
import { askConfirm } from '../../../lib/confirm';
import { initials } from '../../../lib/format';
import { supabase } from '../../../lib/supabase';
import { rpc, useResource } from '../../../lib/studio';
import type { SessionUser } from '../../../lib/session';
import { EmptyState, ErrorBox, Loading, PageHead, Pagination, StatusBadge, type Row } from './ui';

const PAGE_SIZE = 25;
const TEAM_ROLES = ['staff', 'admin', 'superadmin', 'super_admin'];
const ROLE_NAMES: Record<string, string> = { staff: 'Staff', admin: 'Admin', superadmin: 'Super admin', super_admin: 'Super admin', customer: 'Customer' };
const ROLE_OPTIONS: [string, string][] = [
  ['staff', 'Staff'],
  ['admin', 'Admin'],
  ['superadmin', 'Super admin'],
  ['customer', 'Customer (no workspace access)'],
];
const STATUS_NAMES: Record<string, string> = { active: 'Active', inactive: 'Inactive', suspended: 'Suspended' };
const roleTone = (role: string) => (role === 'superadmin' || role === 'super_admin' ? 'danger' : role === 'admin' ? 'info' : role === 'staff' ? 'warning' : 'neutral');
const statusTone = (status: string) => (status === 'active' ? 'success' : status === 'suspended' ? 'danger' : 'neutral');
const cleanSearch = (value: string) => value.replace(/[%_,()*\\"']/g, ' ').trim();

export default function TeamView({ user, revision }: { user: SessionUser; revision: number }) {
  const [tab, setTab] = useState<'team' | 'customers'>('team');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'staff' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(cleanSearch(input));
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const { data, error: loadError, refresh } = useResource(async () => {
    let request = supabase
      .from('users')
      .select('id,full_name,email,role,status', { count: 'exact' })
      .order(tab === 'team' ? 'full_name' : 'created_at', { ascending: tab === 'team' })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    request = tab === 'team' ? request.in('role', TEAM_ROLES) : request.eq('role', 'customer');
    if (query) request = request.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
    const result = await request;
    if (result.error) throw result.error;
    const permissions = await supabase.from('studio_permissions').select('*');
    if (permissions.error) throw permissions.error;
    return { rows: result.data as Row[], count: result.count ?? (result.data?.length || 0), permissions: permissions.data as Row[] };
  }, [revision, page, query, tab]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
      toast.success(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (u: Row, role: string) => {
    const from = ROLE_NAMES[u.role] || u.role;
    const to = ROLE_NAMES[role] || role;
    const ok = await askConfirm({
      title: `Change ${u.full_name}’s role?`,
      message:
        role === 'customer'
          ? `${from} → Customer. They will lose access to the studio workspace and be signed out of it.`
          : `${from} → ${to}. Their current workspace sessions end, and they sign in again with the new access.`,
      confirmLabel: `Make ${to}`,
      tone: role === 'customer' || role === 'superadmin' ? 'danger' : 'primary',
    });
    if (ok) await run(() => callEdge(`/users/${u.id}`, { method: 'PUT', body: { role } }), 'Role updated');
  };

  const changeStatus = async (u: Row, status: string) => {
    const ok = await askConfirm({
      title: status === 'active' ? `Reactivate ${u.full_name}?` : `${status === 'suspended' ? 'Suspend' : 'Deactivate'} ${u.full_name}?`,
      message: status === 'active' ? 'They will be able to sign in again.' : 'They will be signed out and can’t sign in until an admin reactivates the account.',
      confirmLabel: status === 'active' ? 'Reactivate' : status === 'suspended' ? 'Suspend account' : 'Deactivate account',
      tone: status === 'active' ? 'primary' : 'danger',
    });
    if (ok) await run(() => callEdge(`/users/${u.id}`, { method: 'PUT', body: { status } }), 'Account status updated');
  };

  const togglePayments = async (u: Row, allowed: boolean) => {
    const ok = await askConfirm({
      title: allowed ? `Let ${u.full_name} verify payments?` : `Stop ${u.full_name} verifying payments?`,
      message: allowed ? 'They will be able to verify received payments on the bookings assigned to them.' : 'They will still see payments on their assigned bookings.',
      confirmLabel: allowed ? 'Allow' : 'Remove permission',
    });
    if (ok) await run(() => rpc('studio_set_permission', { p_user: u.id, p_verify: allowed }), 'Permission updated');
  };

  const sendReset = async (u: Row) => {
    const ok = await askConfirm({
      title: 'Send a password reset?',
      message: `A private reset link will be emailed to ${u.email}. They choose their own new password, and their authenticator is still required for studio access.`,
      confirmLabel: 'Send reset email',
    });
    if (!ok) return;
    try {
      await callEdge(`/users/${u.id}/password-reset`, { method: 'POST' });
      toast.success(`Password reset email sent to ${u.email}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const invite = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await callEdge('/users', { method: 'POST', body: form });
      setForm({ fullName: '', email: '', role: 'staff' });
    }, `Invitation sent to ${form.email}`);
  };

  return (
    <>
      <PageHead eyebrow="Who can do what" title="Accounts & roles" description="Only super admins manage access. Team members set their own password from the invitation email and set up an authenticator app." />

      <div className="studio-role-guide">
        <p>
          <strong>Staff</strong>
          See and work on the bookings assigned to them.
        </p>
        <p>
          <strong>Admin</strong>
          Manage every booking, payments, the website content and reports.
        </p>
        <p>
          <strong>Super admin</strong>
          Everything admins do, plus inviting people and changing access.
        </p>
      </div>

      <ErrorBox error={error || loadError} />

      <div className={tab === 'team' ? 'ops-grid ops-grid-team' : ''}>
        <section className="ops-panel" aria-label={tab === 'team' ? 'Team accounts' : 'Customer accounts'}>
          <div className="ops-section-head">
            <div className="ops-segmented" role="group" aria-label="Account type">
              <button
                type="button"
                aria-pressed={tab === 'team'}
                className={tab === 'team' ? 'is-active' : ''}
                onClick={() => {
                  setTab('team');
                  setPage(0);
                }}
              >
                Team
              </button>
              <button
                type="button"
                aria-pressed={tab === 'customers'}
                className={tab === 'customers' ? 'is-active' : ''}
                onClick={() => {
                  setTab('customers');
                  setPage(0);
                }}
              >
                Customers
              </button>
            </div>
            <label className="studio-search">
              <Search size={18} aria-hidden="true" />
              <input type="search" aria-label="Search accounts" placeholder="Search by name or email" value={input} onChange={(e) => setInput(e.target.value)} />
            </label>
          </div>

          {!data ? (
            !loadError && <Loading>Loading accounts…</Loading>
          ) : data.rows.length === 0 ? (
            <EmptyState icon={Users} title={query ? 'No matching accounts' : tab === 'team' ? 'No team accounts yet' : 'No customer accounts yet'}>
              {query ? 'Try a different name or email.' : tab === 'team' ? 'Invite your first team member.' : 'Customers appear here when they create an account.'}
            </EmptyState>
          ) : (
            <ul className="ops-account-list">
              {data.rows.map((u) => {
                const role = u.role === 'super_admin' ? 'superadmin' : u.role;
                const self = u.id === user.id;
                const canVerify = data.permissions.some((p) => p.user_id === u.id && p.can_verify_payments);
                return (
                  <li key={u.id} className="ops-account">
                    <div className="ops-account-who">
                      <span className="ops-avatar" aria-hidden="true">
                        {initials(u.full_name)}
                      </span>
                      <span>
                        <strong>
                          {u.full_name} {self && <span className="ops-muted">(you)</span>}
                        </strong>
                        <small>{u.email}</small>
                      </span>
                      <span className="ops-account-badges">
                        <StatusBadge tone={roleTone(role)}>{ROLE_NAMES[role] || role}</StatusBadge>
                        <StatusBadge tone={statusTone(u.status)}>{STATUS_NAMES[u.status] || u.status}</StatusBadge>
                      </span>
                    </div>
                    {self ? (
                      <p className="ops-muted ops-account-note">You can’t change your own role or status. Ask another super admin.</p>
                    ) : (
                      <div className="ops-account-controls">
                        <label>
                          Role
                          <select value={role} disabled={busy} onChange={(e) => void changeRole(u, e.target.value)}>
                            {ROLE_OPTIONS.map(([value, title]) => (
                              <option key={value} value={value}>
                                {title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Status
                          <select value={u.status} disabled={busy} onChange={(e) => void changeStatus(u, e.target.value)}>
                            {Object.entries(STATUS_NAMES).map(([value, title]) => (
                              <option key={value} value={value}>
                                {title}
                              </option>
                            ))}
                          </select>
                        </label>
                        {role === 'staff' && (
                          <label className="ops-check">
                            <input type="checkbox" disabled={busy} checked={canVerify} onChange={(e) => void togglePayments(u, e.target.checked)} />
                            May verify payments on assigned bookings
                          </label>
                        )}
                        {TEAM_ROLES.includes(u.role) && u.status === 'active' && (
                          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void sendReset(u)}>
                            <KeyRound size={15} aria-hidden="true" /> Send password reset
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination page={page} pageCount={data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : undefined} hasNext={!!data && (page + 1) * PAGE_SIZE < data.count} onPage={setPage} />
        </section>

        {tab === 'team' && (
          <section className="ops-panel" aria-labelledby="ops-invite-title">
            <h2 id="ops-invite-title">
              <UserPlus size={18} aria-hidden="true" /> Invite a team member
            </h2>
            <p className="ops-muted">They get an email to set their password, then set up an authenticator on first sign-in.</p>
            <form onSubmit={invite} className="ops-fields">
              <label>
                Full name
                <input value={form.fullName} autoComplete="off" onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </label>
              <label>
                Work email
                <input type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
              <label>
                Role
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLE_OPTIONS.filter(([value]) => value !== 'customer').map(([value, title]) => (
                    <option key={value} value={value}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Sending…' : 'Send invitation'}
              </button>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
