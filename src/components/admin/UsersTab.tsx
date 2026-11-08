import { useMemo, useState, type FormEvent } from 'react';
import { Eye, EyeOff, FileDown, KeyRound, LoaderCircle, Pencil, RefreshCw, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import { callEdge, errorMessage } from '../../lib/api';
import { initials } from '../../lib/format';
import type { SessionUser } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { includesText, ROLE_LABELS, ROLE_TONES, type AdminUser } from './shared';
import type { LoadState } from './AdminDashboard';

interface UsersTabProps {
  currentUser: SessionUser;
  users: AdminUser[];
  state: LoadState;
  onReload: () => Promise<void> | void;
}

const ROLES = ['superadmin', 'admin', 'staff', 'customer'];

export default function UsersTab({ currentUser, users, state, onReload }: UsersTabProps) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [exporting, setExporting] = useState(false);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: users.length };
    ROLES.forEach((value) => {
      map[value] = users.filter((user) => user.role === value).length;
    });
    return map;
  }, [users]);

  const filtered = useMemo(
    () =>
      users.filter((user) => (role === 'all' || user.role === role) && includesText([user.fullName, user.email, user.username, user.phone], query)),
    [users, role, query]
  );

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await callEdge(`/users/${deleting.id}`, { method: 'DELETE' });
      toast.success(`${deleting.fullName} was deleted`);
      setDeleting(null);
      await onReload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete this user.'));
    }
  };

  const handleReset = async () => {
    if (!resetting) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetting.email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      toast.success(`Password reset link sent to ${resetting.email}`);
      setResetting(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not send the reset email.'));
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { exportUsersPdf } = await import('../../lib/pdf');
      await exportUsersPdf(filtered);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the PDF.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="admin-section" aria-labelledby="users-title">
      <header className="admin-head">
        <div>
          <h1 id="users-title">Users</h1>
          <p>
            {counts.customer} customers · {counts.superadmin + counts.admin + counts.staff} team members
          </p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportPdf} disabled={exporting || filtered.length === 0}>
            {exporting ? <LoaderCircle size={16} className="spin" /> : <FileDown size={16} />} Export PDF
          </button>
          <button type="button" className="icon-btn" onClick={() => void onReload()} aria-label="Refresh users" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <UserPlus size={16} /> Add user
          </button>
        </div>
      </header>

      <div className="admin-filters">
        <div className="input-icon admin-search">
          <Search size={18} />
          <input type="search" placeholder="Search name, email, username or phone…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search users" />
        </div>
      </div>

      <div className="chip-row" role="group" aria-label="Filter by role">
        <button type="button" className={`chip chip-sm ${role === 'all' ? 'is-active' : ''}`} onClick={() => setRole('all')} aria-pressed={role === 'all'}>
          All <span className="chip-count">{counts.all}</span>
        </button>
        {ROLES.map((value) => (
          <button key={value} type="button" className={`chip chip-sm ${role === value ? 'is-active' : ''}`} onClick={() => setRole(value)} aria-pressed={role === value}>
            {ROLE_LABELS[value]} <span className="chip-count">{counts[value]}</span>
          </button>
        ))}
      </div>

      {state === 'loading' && (
        <div className="loading-row">
          <LoaderCircle size={20} className="spin" /> Loading users…
        </div>
      )}
      {state === 'error' && (
        <div className="notice notice-danger">
          Users could not be loaded. <button type="button" className="btn-link" onClick={() => void onReload()}>Try again</button>
        </div>
      )}

      {state === 'ready' &&
        (filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={36} />
            <h3>No users match</h3>
            <p>Try another role or search.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const isSelf = user.id === currentUser.id;
                  return (
                    <tr key={user.id}>
                      <td data-label="Name">
                        <span className="cell-user">
                          <span className="avatar avatar-sm">{user.profilePicture ? <img src={user.profilePicture} alt="" /> : initials(user.fullName)}</span>
                          <span className="cell-stack">
                            <strong>
                              {user.fullName}
                              {isSelf && <span className="muted"> (you)</span>}
                            </strong>
                            {user.username && <span className="muted">@{user.username}</span>}
                          </span>
                        </span>
                      </td>
                      <td data-label="Contact">
                        <span className="cell-stack">
                          <span className="cell-ellipsis">{user.email || '—'}</span>
                          <span className="muted">{user.phone || 'No phone'}</span>
                        </span>
                      </td>
                      <td data-label="Role">
                        <span className={`badge badge-plain badge-${ROLE_TONES[user.role] || 'neutral'}`}>{ROLE_LABELS[user.role] || user.role}</span>
                      </td>
                      <td data-label="Status">
                        <span className={`badge badge-${user.status === 'active' ? 'success' : 'neutral'}`}>{user.status === 'active' ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td data-label="Joined">{user.joinDate ? new Date(user.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                      <td className="cell-actions">
                        <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(user)} aria-label={`Edit ${user.fullName}`} title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm"
                          onClick={() => setResetting(user)}
                          disabled={!user.email}
                          aria-label={`Send password reset to ${user.fullName}`}
                          title="Send password reset"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm icon-btn-danger"
                          onClick={() => setDeleting(user)}
                          disabled={isSelf}
                          aria-label={`Delete ${user.fullName}`}
                          title={isSelf ? 'You cannot delete your own account here' : 'Delete'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {editing && (
        <UserForm
          key={editing === 'new' ? 'new' : editing.id}
          user={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.id === currentUser.id}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onReload();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={`Delete ${deleting?.fullName || 'this user'}?`}
        message="Their account and sign-in are removed. This cannot be undone. To pause access instead, edit them and set Status to Inactive."
        confirmLabel="Delete user"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={Boolean(resetting)}
        title="Send a password reset link?"
        message={`An email with a reset link goes to ${resetting?.email || ''}.`}
        confirmLabel="Send link"
        icon={<KeyRound size={22} />}
        onConfirm={handleReset}
        onCancel={() => setResetting(null)}
      />
    </section>
  );
}

interface UserFormProps {
  user: AdminUser | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function UserForm({ user, isSelf, onClose, onSaved }: UserFormProps) {
  const isNew = !user;
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [role, setRole] = useState(user?.role || 'customer');
  const [status, setStatus] = useState<AdminUser['status']>(user?.status || 'active');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next.fullName = 'Enter the full name.';
    if (isNew && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (isNew && password.length < 8) next.password = 'Use at least 8 characters.';
    if (!isNew && password && password.length < 8) next.password = 'Use at least 8 characters, or leave it blank.';
    if (username && !/^[a-z0-9._-]{3,30}$/i.test(username)) next.username = '3–30 letters, numbers, dots, dashes or underscores.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        role: isSelf ? user?.role : role,
        status: isSelf ? user?.status : status,
      };
      if (password) body.password = password;
      if (isNew) {
        body.email = email.trim().toLowerCase();
        await callEdge('/users', { method: 'POST', body });
        toast.success(`${fullName.trim()} was added`);
      } else {
        await callEdge(`/users/${user!.id}`, { method: 'PUT', body });
        toast.success('User updated');
      }
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, isNew ? 'Could not create this user.' : 'Could not update this user.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="md"
      icon={isNew ? <UserPlus size={22} /> : <Pencil size={22} />}
      title={isNew ? 'Add a user' : `Edit ${user!.fullName}`}
      description={isNew ? 'They can sign in right away with this email and password.' : user!.email}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="user-form" className="btn btn-primary" disabled={saving}>
            {saving && <LoaderCircle size={16} className="spin" />}
            {isNew ? 'Create user' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="uf-name">Full name</label>
          <input id="uf-name" type="text" autoComplete="off" value={fullName} onChange={(event) => setFullName(event.target.value)} aria-invalid={Boolean(errors.fullName) || undefined} />
          {errors.fullName && <span className="field-error">{errors.fullName}</span>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="uf-username">
              Username <span className="optional">(optional)</span>
            </label>
            <input id="uf-username" type="text" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} aria-invalid={Boolean(errors.username) || undefined} />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </div>
          <div className="field">
            <label htmlFor="uf-phone">
              Phone <span className="optional">(optional)</span>
            </label>
            <input id="uf-phone" type="tel" autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09XX XXX XXXX" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="uf-email">Email</label>
          <input
            id="uf-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!isNew}
            aria-invalid={Boolean(errors.email) || undefined}
          />
          {!isNew && <span className="field-hint">Email can only be changed by the account owner.</span>}
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="uf-role">Role</label>
            <select id="uf-role" value={role} onChange={(event) => setRole(event.target.value)} disabled={isSelf}>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="uf-status">Status</label>
            <select id="uf-status" value={status} onChange={(event) => setStatus(event.target.value as AdminUser['status'])} disabled={isSelf}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        {isSelf && <p className="field-hint form-note">You can’t change your own role or status.</p>}
        <div className="field">
          <label htmlFor="uf-password">
            {isNew ? 'Password' : 'New password'} {!isNew && <span className="optional">(leave blank to keep)</span>}
          </label>
          <div className="input-affix">
            <input
              id="uf-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password) || undefined}
            />
            <button type="button" className="affix-btn" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </div>
        {role !== 'customer' && !isSelf && (
          <div className="notice notice-warning">
            {ROLE_LABELS[role]} accounts can open the studio dashboard{role === 'superadmin' ? ', manage users and see revenue' : ''}.
          </div>
        )}
      </form>
    </Modal>
  );
}
