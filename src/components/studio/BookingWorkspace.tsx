import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CalendarPlus, ExternalLink, FileText, Lightbulb } from 'lucide-react';
import { askConfirm } from '../../lib/confirm';
import { parseBookingMessage } from '../../lib/bookings';
import type { SessionUser } from '../../lib/session';
import {
  bookingRef,
  calendarFile,
  formatDay,
  formatStamp,
  formatTimeRange,
  galleryText,
  galleryTone,
  label,
  money,
  nextSteps,
  openPrivate,
  paymentText,
  paymentTone,
  requestTone,
  reservationTone,
  rpc,
  uploadPrivate,
  useResource,
  useUnsaved,
  type BookingTab,
} from '../../lib/studio';
import { supabase } from '../../lib/supabase';
import { StatusBadge } from '../admin/operations/ui';

type Row = Record<string, any>;

const CHECKLIST: [string, string][] = [
  ['contact', 'Client contacted'],
  ['venue', 'Venue confirmed'],
  ['brief', 'Brief received'],
  ['equipment', 'Equipment ready'],
  ['shoot', 'Shoot done'],
  ['delivery', 'Gallery delivered'],
];
const PREPARATION: [string, string][] = [
  ['style', 'Style and mood'],
  ['programme', 'Programme / run of show'],
  ['key_people', 'Key people to photograph'],
  ['must_have', 'Must-have shots'],
  ['restrictions', 'Restrictions'],
  ['venue_contact', 'Venue contact'],
];
const REQUEST_KINDS: [string, string][] = [
  ['reschedule', 'Reschedule'],
  ['cancellation', 'Cancellation'],
  ['revision', 'Gallery revision'],
  ['refund', 'Refund'],
];
const PAYMENT_KINDS: Record<string, string> = { deposit: 'Deposit', balance: 'Balance', refund: 'Refund', reversal: 'Correction' };
const FILE_KINDS: [string, string][] = [
  ['reference', 'Reference photo'],
  ['programme', 'Programme'],
  ['brief', 'Brief'],
];
const TAB_NAMES: Record<BookingTab, string> = { details: 'Details', payments: 'Payments', requests: 'Requests', preparation: 'Preparation', conversation: 'Messages', history: 'History', emails: 'Emails' };
const TEAM_FIELDS = ['status', 'transportation_fee', 'assigned_to', 'editor_id', 'support_ids', 'delivery_due', 'checklist', 'needs_information', 'client_note', 'gallery_status', 'gallery_url', 'gallery_access_checked'];
const ADMIN_ONLY_FIELDS = ['transportation_fee', 'assigned_to', 'editor_id', 'support_ids'];
const EMPTY_PAYMENT = { kind: 'balance', method: 'GCash', reference: '', reason: '', receipt_checked: false } as Row;

export default function BookingWorkspace({
  id,
  user,
  team = false,
  revision = 0,
  initialTab,
  onClose,
  onChanged,
}: {
  id: string;
  user: SessionUser;
  team?: boolean;
  revision?: number;
  initialTab?: BookingTab;
  onClose?: () => void;
  onChanged?: () => void;
}) {
  const admin = team && ['admin', 'superadmin'].includes(user.role);
  const tabs: BookingTab[] = ['details', 'payments', 'requests', 'preparation', 'conversation', ...(team ? (['history', 'emails'] as BookingTab[]) : [])];
  const [tab, setTab] = useState<BookingTab>(initialTab && tabs.includes(initialTab) ? initialTab : 'details');
  const [busy, setBusy] = useState(false);
  const [attention, setAttention] = useState<'pending'|'seen'|'failed'>('pending');
  const [attentionRetry, setAttentionRetry] = useState(0);
  const [error, setError] = useState('');

  // Session details draft (team: details tab; client: preparation brief).
  const [draft, setDraft] = useState<Row | null>(null);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [archiveReason, setArchiveReason] = useState('');

  // Each form keeps its own text, so typing in one never fills another.
  const [note, setNote] = useState('');
  const [internal, setInternal] = useState(false);
  const [requestKind, setRequestKind] = useState('reschedule');
  const [request, setRequest] = useState<Row>({ reason: '' });
  const [payment, setPayment] = useState<Row>(EMPTY_PAYMENT);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState('reference');
  const [reviewReason, setReviewReason] = useState('');
  const [receiptChecked, setReceiptChecked] = useState(false);
  const [decision, setDecision] = useState('');
  const [acceptPrice, setAcceptPrice] = useState(false);

  const { data, error: loadError, refresh } = useResource(async () => {
    const tables = ['booking_payments', 'booking_requests', 'booking_notes', 'booking_files'];
    const [booking, ...lists] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', id).single(),
      ...tables.map((t) => supabase.from(t).select('*').eq('booking_id', id).order('created_at', { ascending: false }).limit(200)),
    ]);
    if (booking.error) throw new Error('This booking is unavailable or you no longer have access.');
    for (const list of lists) if (list.error) throw list.error;
    const directory = team ? await rpc<Row[]>('studio_team_directory') : [];
    const verify = team ? await rpc<boolean>('studio_can_verify_payment') : false;
    const emails = team ? await rpc<Row[]>('studio_email_history', { p_booking: id }) : [];
    return { b: booking.data as Row, payments: (lists[0].data || []) as Row[], requests: (lists[1].data || []) as Row[], notes: (lists[2].data || []) as Row[], files: (lists[3].data || []) as Row[], directory, verify, emails };
  }, [id, team]);

  useEffect(() => {
    void refresh();
  }, [revision, refresh]);

  useEffect(() => {
    if (data && !dirty) {
      setDraft(data.b);
      setBaseVersion(data.b.version);
    }
  }, [data, dirty]);

  useEffect(() => {
    if (!admin || data?.b.id !== id) return;
    let active = true;
    setAttention('pending');
    void rpc('studio_acknowledge_booking', { p_booking: id })
      .then(() => { if (active) setAttention('seen'); })
      .catch(() => { if (active) setAttention('failed'); });
    return () => { active = false; };
  }, [admin, id, data?.b.id, attentionRetry]);

  const unsaved = dirty || !!note || !!proofFile || !!referenceFile || !!request.reason || !!reviewReason || !!decision || !!changeReason || !!archiveReason || !!payment.amount || !!payment.reference || !!payment.reason;
  useUnsaved(unsaved);

  const change = (key: string, value: unknown) => {
    setDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const perform = async (fn: () => Promise<unknown>, message = 'Saved', after?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
      after?.();
      await refresh();
      onChanged?.();
      toast.success(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Your draft is still here.');
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (unsaved && !(await askConfirm({ title: 'Discard unsaved changes?', message: 'You have changes on this booking that are not saved yet.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', tone: 'danger' }))) return;
    onClose?.();
  };

  if (!data) {
    return (
      <section className="ops-panel">
        {onClose && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void close()}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to bookings
          </button>
        )}
        <p role={loadError ? 'alert' : 'status'}>{loadError || 'Opening booking…'}</p>
        {loadError && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void refresh()}>
            Try again
          </button>
        )}
      </section>
    );
  }

  const b = data.b;
  const d = draft || b;
  const archived = !!b.archived_at;
  const stale = dirty && baseVersion !== b.version;
  const legacyProof = String(parseBookingMessage(b.message).meta?.paymentReceiptUrl || '');
  const hasLegacyProof = /^data:image\/(jpeg|png|webp);base64,/i.test(legacyProof);
  const outstanding = Math.max(0, b.total_price - b.paid_amount + b.refunded_amount);
  const pendingDeposits = data.payments.filter(p=>p.status==='pending' && p.kind==='deposit').reduce((n,p)=>n+Number(p.amount),0);
  const pendingRequests = data.requests.filter((r) => r.status === 'pending').length;
  const pendingPayments = data.payments.filter((p) => p.status === 'pending').length;
  const steps = team ? nextSteps(b) : [];
  const clientMessage = String(b.message || '').split('\n\n---BOOKING_META---\n')[0].trim();
  const Heading = team ? 'h1' : 'h2';

  const payAction = (kind: string, detail: Row, message: string) =>
    perform(
      () => rpc('studio_payment_action', { p_booking: id, p_version: b.version, p_action: kind, p_data: detail }),
      message,
      () => {
        setReviewReason('');
        setReceiptChecked(false);
        if (kind === 'record') setPayment(EMPTY_PAYMENT);
      }
    );

  const save = () =>
    perform(
      () =>
        team
          ? rpc('studio_update_booking', {
              p_id: id,
              p_version: baseVersion,
              p_changes: Object.fromEntries(TEAM_FIELDS.filter((k) => admin || !ADMIN_ONLY_FIELDS.includes(k)).map((k) => [k, d[k] ?? (k === 'gallery_access_checked' ? false : null)])),
              p_reason: changeReason,
            })
          : rpc('studio_save_preparation', { p_booking: id, p_version: baseVersion, p_details: d.preparation || {} }),
      'Changes saved',
      () => {
        setDirty(false);
        setChangeReason('');
      }
    );

  const loadLatest = async () => {
    if (await askConfirm({ title: 'Load the latest details?', message: 'Your unsaved edits on this booking will be replaced by what is saved now.', confirmLabel: 'Load latest', tone: 'danger' })) {
      setDirty(false);
      setDraft(b);
      setBaseVersion(b.version);
    }
  };

  const submitProof = () =>
    perform(
      async () => {
        if (!proofFile) throw new Error('Choose your payment proof.');
        const path = await uploadPrivate('payment-receipts', user.id, proofFile);
        await rpc('studio_payment_action', { p_booking: id, p_version: b.version, p_action: 'submit_proof', p_data: { ...payment, proof_path: path, proof_name: proofFile.name } });
      },
      'Proof submitted for review',
      () => {
        setProofFile(null);
        setPayment(EMPTY_PAYMENT);
      }
    );

  const recordEntry = async () => {
    const amount = Number(payment.amount) || 0;
    if (!amount) return setError('Enter the amount first.');
    const ok = await askConfirm({
      title: payment.kind === 'refund' ? 'Record this refund?' : 'Record this payment?',
      message: `${PAYMENT_KINDS[payment.kind] || label(payment.kind)} of ${money(amount)} by ${payment.method}. Ledger entries can’t be deleted later, only corrected with a reversal.`,
      confirmLabel: 'Record entry',
    });
    if (ok) await payAction('record', payment, 'Entry recorded');
  };

  const showSaveBar = ((team && tab === 'details') || (!team && tab === 'preparation')) && !archived;

  return (
    <section className={`ops-detail ${showSaveBar ? 'has-save-bar' : ''}`}>
      <header className="ops-detail-head">
        <div>
          {onClose && (
            <button type="button" className="btn btn-ghost btn-sm ops-back" onClick={() => void close()}>
              <ArrowLeft size={16} aria-hidden="true" /> Back to bookings
            </button>
          )}
          <p className="studio-eyebrow">
            {bookingRef(id)}
            {archived ? ' · Archived' : ''}
          </p>
          <Heading>{team ? b.full_name : b.service}</Heading>
          <p className="ops-detail-when">
            {formatDay(b.booking_date)} · {formatTimeRange(b.start_time, b.end_time)} · {b.service}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => calendarFile(b)}>
          <CalendarPlus size={16} aria-hidden="true" /> Add to calendar
        </button>
      </header>

      {admin && b.status === 'pending' && <div className={attention === 'failed' ? 'notice notice-danger' : 'ops-muted'} role={attention === 'failed' ? 'alert' : 'status'}>
        {attention === 'seen' ? 'Marked as seen by the studio. Owner reminders have stopped; reservation and payment approval are still separate.' : attention === 'pending' ? 'Marking this booking as seen…' : <>We could not mark this booking as seen. Owner reminders may continue. <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAttentionRetry(n => n + 1)}>Retry acknowledgement</button></>}
      </div>}
      <div className="ops-status-strip">
        <div>
          <small>Reservation</small>
          <StatusBadge tone={reservationTone(b.status)}>{label(b.status)}</StatusBadge>
        </div>
        <div>
          <small>Payment</small>
          <StatusBadge tone={paymentTone(b.payment_state)}>{paymentText(b.payment_state)}</StatusBadge>
        </div>
        <div>
          <small>Delivery</small>
          <StatusBadge tone={galleryTone(b.gallery_status)}>{galleryText(b.gallery_status)}</StatusBadge>
        </div>
        <div>
          <small>{pendingDeposits ? 'Balance if deposit is verified' : 'Remaining balance'}</small>
          <strong>{b.status === 'cancelled' ? 'Cancelled' : money(Math.max(0,outstanding-pendingDeposits))}</strong>
        </div>
      </div>

      {steps.length > 0 && (
        <div className={`ops-next ops-tone-${steps[0].tone}`}>
          <Lightbulb size={18} aria-hidden="true" />
          <span>
            <strong>Next step: {steps[0].text.toLowerCase()}.</strong>
            {steps.length > 1 && <small> Also: {steps.slice(1).map((s) => s.text.toLowerCase()).join(', ')}.</small>}
          </span>
          {tab !== steps[0].tab && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab(steps[0].tab)}>
              {steps[0].action}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      )}
      {loadError && (
        <p className="notice notice-danger" role="alert">
          {loadError}
        </p>
      )}
      {stale && (
        <div className="notice notice-warning" role="alert">
          <span>Someone else saved this booking while you were editing. Your draft is kept, but it can’t be saved over their changes.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadLatest()}>
            Load latest details
          </button>
        </div>
      )}

      <nav className="ops-tabs" aria-label="Booking sections">
        {tabs.map((t) => {
          const count = t === 'requests' ? pendingRequests : t === 'payments' && team ? pendingPayments : 0;
          return (
            <button key={t} type="button" aria-current={tab === t ? 'page' : undefined} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
              {TAB_NAMES[t]}
              {count > 0 && (
                <span className="ops-count" aria-label={`${count} pending`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === 'details' && (
        <div className="ops-grid">
          <section className="ops-panel">
            <h3>Session details</h3>
            <dl className="ops-definitions">
              <dt>Client</dt>
              <dd>{b.full_name}</dd>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${b.email}`}>{b.email}</a>
              </dd>
              <dt>Phone</dt>
              <dd>{b.phone ? <a href={`tel:${b.phone}`}>{b.phone}</a> : 'Not provided'}</dd>
              <dt>Location</dt>
              <dd>{b.location || 'Not provided'}</dd>
              <dt>Session total</dt>
              <dd>{money(b.total_price)}</dd>
              <dt>Verified payments</dt>
              <dd>{money(b.paid_amount)}</dd>
              <dt>Recorded refunds</dt>
              <dd>{money(b.refunded_amount)}</dd>
              {b.delivery_due && (
                <>
                  <dt>Gallery due</dt>
                  <dd>{formatDay(b.delivery_due)}</dd>
                </>
              )}
            </dl>
            {clientMessage && (
              <div className="ops-quote">
                <small>{team ? 'Client’s message' : 'Your message'}</small>
                <p className="ops-whitespace">{clientMessage}</p>
              </div>
            )}
            {b.client_note && (
              <div className="notice">
                <span>
                  <strong>From the studio</strong>
                  <br />
                  {b.client_note}
                </span>
              </div>
            )}
            {b.gallery_url && ['ready', 'delivered', 'revision_requested'].includes(b.gallery_status) && /^https:\/\//.test(b.gallery_url) && (
              <a className="btn btn-primary" href={b.gallery_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" /> {team ? 'Open gallery' : 'Open your gallery'}
              </a>
            )}
            {!team && <p className="ops-muted">Need to change something? Send a request from the Requests tab. Your original time stays reserved until the studio approves a change.</p>}
          </section>

          {team && (
            <section className="ops-panel">
              <h3>Manage this session</h3>
              <fieldset disabled={busy || archived} className="ops-fields">
                <label>
                  Reservation status
                  <select value={d.status} onChange={(e) => change('status', e.target.value)}>
                    {['pending', 'confirmed', 'completed', ...(admin ? ['cancelled'] : [])].map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
                {admin && (
                  <>
                    <label>
                      Transportation fee (PHP)
                      <input type="number" min="0" value={d.transportation_fee ?? 0} onChange={(e) => change('transportation_fee', Number(e.target.value))} />
                    </label>
                    <div className="ops-fields-2">
                      {[
                        ['assigned_to', 'Photographer'],
                        ['editor_id', 'Editor'],
                      ].map(([key, name]) => (
                        <label key={key}>
                          {name}
                          <select value={d[key] || ''} onChange={(e) => change(key, e.target.value || null)}>
                            <option value="">Unassigned</option>
                            {data.directory.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.full_name} · {label(p.role)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    {data.directory.length > 0 && (
                      <fieldset>
                        <legend>Support team</legend>
                        {data.directory.map((p) => (
                          <label className="ops-check" key={p.id}>
                            <input
                              type="checkbox"
                              checked={(d.support_ids || []).includes(p.id)}
                              onChange={(e) => change('support_ids', e.target.checked ? [...(d.support_ids || []), p.id] : (d.support_ids || []).filter((x: string) => x !== p.id))}
                            />
                            {p.full_name}
                          </label>
                        ))}
                      </fieldset>
                    )}
                  </>
                )}
                <div className="ops-fields-2">
                  <label>
                    Gallery due
                    <input type="date" value={d.delivery_due || ''} onChange={(e) => change('delivery_due', e.target.value || null)} />
                  </label>
                  <label>
                    Gallery progress
                    <select value={d.gallery_status} onChange={(e) => change('gallery_status', e.target.value)}>
                      {['not_started', 'editing', 'ready', 'delivered', 'revision_requested'].map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Private gallery link
                  <input
                    type="url"
                    value={d.gallery_url || ''}
                    onChange={(e) => {
                      change('gallery_url', e.target.value);
                      change('gallery_access_checked', false);
                    }}
                    placeholder="https://…"
                  />
                </label>
                <label className="ops-check">
                  <input type="checkbox" checked={d.gallery_access_checked === true} onChange={(e) => change('gallery_access_checked', e.target.checked)} />I checked that this gallery opens for the intended client.
                </label>
                <label>
                  Note the client can see
                  <textarea value={d.client_note || ''} maxLength={2000} onChange={(e) => change('client_note', e.target.value)} />
                </label>
                <label className="ops-check">
                  <input type="checkbox" checked={!!d.needs_information} onChange={(e) => change('needs_information', e.target.checked)} />
                  Waiting for information from the client
                </label>
                <fieldset>
                  <legend>Session checklist</legend>
                  <div className="ops-checklist">
                    {CHECKLIST.map(([key, title]) => (
                      <label key={key} className="ops-check">
                        <input type="checkbox" checked={d.checklist?.[key] === true} onChange={(e) => change('checklist', { ...d.checklist, [key]: e.target.checked })} />
                        {title}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  Reason for this change <span className="optional">(required to cancel or change the price)</span>
                  <textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="e.g. Client asked to move to the afternoon" maxLength={1000} />
                </label>
              </fieldset>
            </section>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="ops-grid">
          <section className="ops-panel">
            <h3>Payment ledger</h3>
            <p className="ops-muted">Check each GCash receipt against money actually received in the studio account. A screenshot alone doesn’t confirm payment. Refund entries record a refund already made outside this website.</p>
            {team && data.verify && pendingPayments > 0 && !archived && (
              <div className="ops-review-box">
                <strong>Reviewing a payment</strong>
                <label className="ops-check">
                  <input type="checkbox" checked={receiptChecked} onChange={(e) => setReceiptChecked(e.target.checked)} />I checked the amount and reference against money received in the studio account.
                </label>
                <label className="field">
                  Note for this decision <span className="optional">(needed to reject, at least 5 characters)</span>
                  <textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} maxLength={1000} />
                </label>
              </div>
            )}
            {data.payments.length === 0 ? (
              <p className="ops-muted">No payment records yet.</p>
            ) : (
              data.payments.map((p) => (
                <article className="ops-entry" key={p.id}>
                  <div className="ops-entry-head">
                    <strong>
                      {PAYMENT_KINDS[p.kind] || label(p.kind)} · {money(p.amount)}
                    </strong>
                    <StatusBadge tone={p.status === 'verified' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}>{label(p.status)}</StatusBadge>
                  </div>
                  <small>
                    {p.method} · {p.reference || 'No reference'} · {formatStamp(p.occurred_at || p.created_at)}
                  </small>
                  {p.source === 'legacy' && <small>Imported from the previous booking record.</small>}
                  {p.reason && <p>{p.reason}</p>}
                  {p.source === 'legacy' && !p.proof_path && hasLegacyProof && (
                    <details>
                      <summary>View imported payment proof</summary>
                      <img src={legacyProof} alt="Imported payment receipt" style={{ maxWidth: '100%', maxHeight: 600, objectFit: 'contain' }} />
                    </details>
                  )}
                  <div className="ops-entry-actions">
                    {p.proof_path && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void openPrivate('payment-receipts', p.proof_path).catch((e) => setError(e.message))}>
                        <FileText size={15} aria-hidden="true" /> View proof
                      </button>
                    )}
                    {team && data.verify && p.status === 'pending' && !archived && (
                      <>
                        <button
                          type="button"
                          disabled={busy || !receiptChecked}
                          className="btn btn-primary btn-sm"
                          title={receiptChecked ? undefined : 'Tick the check box above first'}
                          onClick={() => void payAction('review', { id: p.id, status: 'verified', receipt_checked: receiptChecked, reason: reviewReason }, 'Payment verified')}
                        >
                          Verify payment
                        </button>
                        <button type="button" disabled={busy || reviewReason.trim().length < 5} className="btn btn-ghost btn-sm" onClick={() => void payAction('review', { id: p.id, status: 'rejected', reason: reviewReason }, 'Proof rejected')}>
                          Reject proof
                        </button>
                      </>
                    )}
                    {admin && p.status === 'verified' && p.kind !== 'reversal' && !data.payments.some((r) => r.reversal_of === p.id) && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy || reviewReason.trim().length < 5} title="Write a note above first" onClick={() => void payAction('reverse', { id: p.id, reason: reviewReason }, 'Entry reversed')}>
                        Reverse this entry
                      </button>
                    )}
                    {!team && p.status === 'pending' && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPayment({ ...payment, replaces: p.id, amount: p.amount, reference: p.reference })}>
                        Replace this proof
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
            {admin && !archived && !(data.verify && pendingPayments > 0) && data.payments.some((p) => p.status === 'verified') && (
              <label className="field">
                Correction note <span className="optional">(needed to reverse an entry)</span>
                <textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} maxLength={1000} />
              </label>
            )}
          </section>

          {(admin || !team) && !archived && (
            <section className="ops-panel">
              <h3>{team ? 'Record a payment or refund' : 'Send payment proof'}</h3>
              <fieldset className="ops-fields" disabled={busy || (b.status === 'cancelled' && !team)}>
                {team && (
                  <div className="ops-fields-2">
                    <label>
                      Entry type
                      <select value={payment.kind} onChange={(e) => setPayment({ ...payment, kind: e.target.value })}>
                        {['deposit', 'balance', 'refund'].map((s) => (
                          <option key={s} value={s}>
                            {PAYMENT_KINDS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Method
                      <select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                        {['GCash', 'Cash', 'Bank transfer', 'Other'].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <div className="ops-fields-2">
                  <label>
                    Amount (PHP)
                    <input type="number" min="0.01" step="0.01" value={payment.amount || ''} onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })} />
                  </label>
                  <label>
                    Transaction reference
                    <input maxLength={80} value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
                  </label>
                </div>
                {team ? (
                  <>
                    <label>
                      Note
                      <textarea value={payment.reason} onChange={(e) => setPayment({ ...payment, reason: e.target.value })} />
                    </label>
                    <label className="ops-check">
                      <input type="checkbox" checked={payment.receipt_checked} onChange={(e) => setPayment({ ...payment, receipt_checked: e.target.checked })} />I confirmed the money was received, or the refund was made.
                    </label>
                    <button type="button" className="btn btn-primary" onClick={() => void recordEntry()}>
                      Record entry
                    </button>
                  </>
                ) : (
                  <>
                    <label>
                      Payment screenshot or PDF <span className="optional">(up to 10 MB)</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                    </label>
                    {payment.replaces && <p className="ops-muted">This replaces your pending proof. The earlier one stays in the history.</p>}
                    <button type="button" className="btn btn-primary" onClick={() => void submitProof()}>
                      {busy ? 'Uploading and saving…' : 'Send proof'}
                    </button>
                  </>
                )}
              </fieldset>
            </section>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="ops-grid">
          <section className="ops-panel">
            <h3>Requests and decisions</h3>
            {!data.requests.length && <p className="ops-muted">No requests yet.</p>}
            {data.requests.map((r) => (
              <article key={r.id} className="ops-entry">
                <div className="ops-entry-head">
                  <strong>{REQUEST_KINDS.find(([k]) => k === r.kind)?.[1] || label(r.kind)}</strong>
                  <StatusBadge tone={requestTone(r.status)}>{label(r.status)}</StatusBadge>
                </div>
                <small>{formatStamp(r.created_at)}</small>
                {r.reason && <p>{r.reason}</p>}
                {r.requested_date && (
                  <p>
                    Proposed: {formatDay(r.requested_date)} · {formatTimeRange(r.start_time, r.end_time)}
                  </p>
                )}
                {r.amount != null && Number(r.amount) > 0 && <p>Amount: {money(r.amount)}</p>}
                {r.response && (
                  <p>
                    <strong>Studio response:</strong> {r.response}
                  </p>
                )}
                {r.status === 'pending' && (
                  <div className="ops-entry-actions">
                    {admin && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy || decision.trim().length < 5}
                          title={decision.trim().length < 5 ? 'Write a response below first' : undefined}
                          onClick={() => void perform(() => rpc('studio_resolve_request', { p_id: r.id, p_version: b.version, p_decision: 'approved', p_response: decision, p_accept_price: acceptPrice }), 'Request approved', () => setDecision(''))}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy || decision.trim().length < 5}
                          onClick={() => void perform(() => rpc('studio_resolve_request', { p_id: r.id, p_version: b.version, p_decision: 'declined', p_response: decision }), 'Request declined', () => setDecision(''))}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {r.created_by === user.id && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void perform(() => rpc('studio_resolve_request', { p_id: r.id, p_version: b.version, p_decision: 'withdrawn', p_response: '' }), 'Request withdrawn')}>
                        Withdraw request
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
            {admin && pendingRequests > 0 && (
              <div className="ops-review-box">
                <label className="field">
                  Response to the client <span className="optional">(at least 5 characters)</span>
                  <textarea value={decision} onChange={(e) => setDecision(e.target.value)} />
                </label>
                <label className="ops-check">
                  <input type="checkbox" checked={acceptPrice} onChange={(e) => setAcceptPrice(e.target.checked)} />I reviewed any change in duration and price with the client.
                </label>
                <p className="ops-muted">Approving a refund request doesn’t send money. Record the completed refund under Payments.</p>
              </div>
            )}
          </section>

          {!archived && (
            <section className="ops-panel">
              <h3>Request a change</h3>
              <fieldset disabled={busy} className="ops-fields">
                <label>
                  What would you like to change?
                  <select
                    value={requestKind}
                    onChange={(e) => {
                      setRequestKind(e.target.value);
                      setRequest({ reason: request.reason });
                    }}
                  >
                    {REQUEST_KINDS.map(([value, title]) => (
                      <option key={value} value={value}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                {requestKind === 'reschedule' && (
                  <>
                    <label>
                      Proposed date
                      <input type="date" value={request.date || ''} onChange={(e) => setRequest({ ...request, date: e.target.value })} />
                    </label>
                    <div className="ops-fields-2">
                      <label>
                        Start (Manila time)
                        <input type="time" value={request.start || ''} onChange={(e) => setRequest({ ...request, start: e.target.value })} />
                      </label>
                      <label>
                        End (Manila time)
                        <input type="time" value={request.end || ''} onChange={(e) => setRequest({ ...request, end: e.target.value })} />
                      </label>
                    </div>
                    <p className="ops-muted">The new time is checked again when the studio approves it. The original time stays reserved until then.</p>
                  </>
                )}
                {requestKind === 'refund' && (
                  <label>
                    Requested amount (PHP)
                    <input type="number" min="0.01" step="0.01" value={request.amount || ''} onChange={(e) => setRequest({ ...request, amount: Number(e.target.value) })} />
                  </label>
                )}
                <label>
                  Reason
                  <textarea maxLength={2000} value={request.reason} onChange={(e) => setRequest({ ...request, reason: e.target.value })} />
                </label>
                <button type="button" className="btn btn-primary" onClick={() => void perform(() => rpc('studio_request_change', { p_booking: id, p_kind: requestKind, p_data: request }), 'Request sent for review', () => setRequest({ reason: '' }))}>
                  Send request
                </button>
              </fieldset>
            </section>
          )}
        </div>
      )}

      {tab === 'preparation' && (
        <div className="ops-grid">
          <section className="ops-panel">
            <h3>Prepare for the shoot</h3>
            {team && <p className="ops-muted">The client fills in this brief. Use Messages for questions, and internal notes for team instructions.</p>}
            <div className="ops-fields">
              {PREPARATION.map(([key, title]) => (
                <label key={key}>
                  {title}
                  <textarea maxLength={1500} readOnly={team || archived} value={d.preparation?.[key] || ''} placeholder={team ? 'Not filled in yet' : undefined} onChange={(e) => change('preparation', { ...d.preparation, [key]: e.target.value })} />
                </label>
              ))}
            </div>
          </section>
          <section className="ops-panel">
            <h3>Private reference files</h3>
            {data.files.length === 0 && <p className="ops-muted">No files yet.</p>}
            {data.files.map((f) => (
              <article className="ops-entry ops-file" key={f.id}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void openPrivate('studio-files', f.path).catch((e) => setError(e.message))}>
                  <FileText size={15} aria-hidden="true" /> {f.name}
                </button>
                <small>{FILE_KINDS.find(([k]) => k === f.kind)?.[1] || label(f.kind)}</small>
              </article>
            ))}
            {!archived && (
              <fieldset disabled={busy} className="ops-fields">
                <label>
                  File type
                  <select value={fileKind} onChange={(e) => setFileKind(e.target.value)}>
                    {FILE_KINDS.map(([value, title]) => (
                      <option key={value} value={value}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Image or PDF <span className="optional">(up to 10 MB)</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setReferenceFile(e.target.files?.[0] || null)} />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    void perform(
                      async () => {
                        if (!referenceFile) throw new Error('Choose a file first.');
                        const path = await uploadPrivate('studio-files', user.id, referenceFile);
                        await rpc('studio_add_file', { p_booking: id, p_path: path, p_name: referenceFile.name, p_kind: fileKind });
                      },
                      'File uploaded',
                      () => setReferenceFile(null)
                    )
                  }
                >
                  {busy ? 'Uploading…' : 'Upload private file'}
                </button>
              </fieldset>
            )}
          </section>
        </div>
      )}

      {tab === 'conversation' && (
        <section className="ops-panel">
          <h3>Messages</h3>
          <p className="ops-muted">Messages are visible to the client and the assigned team. Internal notes stay with the team.</p>
          <div className="ops-messages">
            {data.notes
              .slice()
              .reverse()
              .map((n) => (
                <article className={`ops-message ${n.internal ? 'ops-internal' : ''}`} key={n.id}>
                  <div className="ops-entry-head">
                    <strong>{n.author_name}</strong>
                    {n.internal && <StatusBadge tone="warning">Internal note</StatusBadge>}
                  </div>
                  <small>{formatStamp(n.created_at)}</small>
                  <p className="ops-whitespace">{n.body}</p>
                </article>
              ))}
            {!data.notes.length && <p className="ops-muted">No messages yet.</p>}
          </div>
          <label className="field">
            {internal && team ? 'Internal note' : 'Message'}
            <textarea maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={internal && team ? 'Only the team will see this…' : 'Write your message…'} />
          </label>
          <div className="ops-entry-actions">
            {team && (
              <label className="ops-check">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                Internal team note
              </label>
            )}
            <button type="button" className="btn btn-primary" disabled={busy || !note.trim()} onClick={() => void perform(() => rpc('studio_add_note', { p_booking: id, p_body: note, p_internal: team && internal }), internal && team ? 'Internal note added' : 'Message sent', () => setNote(''))}>
              {busy ? 'Sending…' : internal && team ? 'Save internal note' : 'Send message'}
            </button>
          </div>
        </section>
      )}

      {tab === 'history' && team && <BookingHistory id={id} revision={revision + b.version} />}

      {tab === 'emails' && team && (
        <section className="ops-panel">
          <h3>Booking emails</h3>
          <p className="ops-muted">“Sent” means the email provider accepted it. “Delivered” needs a signed delivery event from the provider.</p>
          {data.emails.length === 0 && <p className="ops-muted">No emails for this booking yet.</p>}
          {data.emails.map((e) => (
            <article className="ops-entry" key={e.id}>
              <div className="ops-entry-head">
                <strong>{label(e.kind)}</strong>
                <StatusBadge tone={e.state === 'failed' ? 'danger' : e.delivery_state === 'delivered' ? 'success' : 'neutral'}>
                  {label(e.state)} · {label(e.delivery_state)}
                </StatusBadge>
              </div>
              <small>
                {formatStamp(e.created_at)} · {e.attempts} {e.attempts === 1 ? 'attempt' : 'attempts'}
              </small>
              {e.last_error && <p className="ops-error-text">{e.last_error}</p>}
              {admin && e.state === 'failed' && (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void perform(() => rpc('studio_retry_email', { p_id: e.id }), 'Queued for retry')}>
                  Retry email
                </button>
              )}
            </article>
          ))}
        </section>
      )}

      {admin && tab === 'details' && (
        <section className="ops-panel ops-archive">
          <h3>{archived ? 'Restore this booking' : 'Archive this booking'}</h3>
          <p className="ops-muted">Archiving hides a finished booking from the active lists. Its payments, requests and messages are kept. Resolve anything pending first.</p>
          <div className="ops-archive-row">
            <label className="field">
              Reason <span className="optional">(at least 5 characters)</span>
              <input value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} maxLength={500} />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || archiveReason.trim().length < 5}
              onClick={() => void perform(() => rpc('studio_archive_booking', { p_id: id, p_version: b.version, p_reason: archiveReason, p_restore: archived }), archived ? 'Booking restored' : 'Booking archived', () => setArchiveReason(''))}
            >
              {archived ? 'Restore booking' : 'Archive booking'}
            </button>
          </div>
        </section>
      )}

      {showSaveBar && (
        <div className={`ops-sticky ${dirty || stale ? 'is-pinned' : ''}`}>
          <span role="status">{busy ? 'Saving…' : !navigator.onLine ? 'Offline · keep this page open; your draft is kept.' : stale ? 'Load the latest details before saving' : dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
          <button type="button" className="btn btn-primary" disabled={busy || !dirty || stale || !navigator.onLine} onClick={() => void save()}>
            Save changes
          </button>
        </div>
      )}
    </section>
  );
}

function BookingHistory({ id, revision }: { id: string; revision: number }) {
  const { data, error } = useResource(async () => {
    const { data, error } = await supabase.from('studio_activity').select('*').eq('resource', 'bookings').eq('record_id', id).order('occurred_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data as Row[];
  }, [id, revision]);
  return (
    <section className="ops-panel">
      <h3>Booking history</h3>
      {error && (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      )}
      {data?.length === 0 && <p className="ops-muted">No recorded changes yet.</p>}
      {data?.map((a) => (
        <article className="ops-entry" key={a.id}>
          <div className="ops-entry-head">
            <strong>{a.actor_name || label(a.actor_role)}</strong>
            <span className="ops-muted">{label(a.action)}</span>
          </div>
          <small>{formatStamp(a.occurred_at)}</small>
          <p>
            {a.changed_fields?.map(label).join(', ') || 'Record created'}
            {a.status_after ? ` · ${label(a.status_after)}` : ''}
          </p>
        </article>
      ))}
    </section>
  );
}
