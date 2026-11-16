import { AlertTriangle, CalendarDays, CalendarRange, Hourglass, ImageOff, MailWarning, MessageSquareMore, UserX, Wallet, type LucideIcon } from 'lucide-react';
import { formatClock, formatDay, formatDayShort, formatTimeRange, rpc, useResource } from '../../../lib/studio';
import type { SessionUser } from '../../../lib/session';
import { addDaysKey, todayKey } from '../shared';
import { ActionRows, EmptyState, ErrorBox, Loading, PageHead, nextSteps, type OpenBooking, type Row } from './ui';

export type BookingPreset = { view?: string; status?: string };

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

type Metric = { key: string; title: string; icon: LucideIcon; preset: BookingPreset; tone: 'warning' | 'danger' | 'info'; hint: string };
const METRICS: Metric[] = [
  { key: 'today', title: 'Today’s shoots', icon: CalendarDays, preset: { view: 'today' }, tone: 'info', hint: 'Confirmed for today' },
  { key: 'pending', title: 'Pending bookings', icon: Hourglass, preset: { status: 'pending' }, tone: 'warning', hint: 'Waiting for a decision' },
  { key: 'unreviewed', title: 'Payment reviews', icon: Wallet, preset: { view: 'payments' }, tone: 'warning', hint: 'Receipts to check' },
  { key: 'requests', title: 'Client requests', icon: MessageSquareMore, preset: { view: 'requests' }, tone: 'warning', hint: 'Changes to answer' },
  { key: 'overdue', title: 'Overdue galleries', icon: ImageOff, preset: { view: 'overdue' }, tone: 'danger', hint: 'Past the delivery date' },
  { key: 'unassigned', title: 'Unassigned', icon: UserX, preset: { view: 'unassigned' }, tone: 'info', hint: 'No photographer yet' },
];

export default function OverviewView({ user, revision, onOpen, onView, onNavigate }: { user: SessionUser; revision: number; onOpen: OpenBooking; onView: (preset: BookingPreset) => void; onNavigate: (tab: 'notifications') => void }) {
  const today = todayKey();
  const { data, error, loading } = useResource<Row>(() => rpc('studio_overview'), [revision]);
  const week = useResource<Row[]>(() => rpc('studio_calendar', { p_from: today, p_to: addDaysKey(7), p_mine: false }), [revision, today]);
  const firstName = user.firstName || user.fullName.split(' ')[0];

  const todays = (week.data || []).filter((b) => b.booking_date === today);
  const upcoming = (week.data || []).filter((b) => b.booking_date > today).slice(0, 5);
  const queue = ((data?.queue as Row[]) || []).filter((b) => nextSteps(b).length).slice(0, 8);

  return (
    <>
      <PageHead eyebrow="Your studio, in focus" title={`${greeting()}, ${firstName}.`} description={`Here’s what needs attention on ${formatDay(today)}. All times are Philippine time.`} />
      <ErrorBox error={error} />
      {loading && !data ? (
        <Loading>Loading your workday…</Loading>
      ) : (
        data && (
          <>
            <div className="ops-metrics ops-metrics-overview">
              {METRICS.map(({ key, title, icon: Icon, preset, tone, hint }) => {
                const count = Number(data[key]) || 0;
                return (
                  <button key={key} type="button" className={`ops-metric ${count ? `is-${tone}` : 'is-clear'}`} onClick={() => onView(preset)}>
                    <span className="ops-metric-icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <small>{title}</small>
                    <strong>{count}</strong>
                    <span className="ops-metric-hint">{count ? hint : 'All clear'}</span>
                  </button>
                );
              })}
            </div>

            {data.late_reviews > 0 && (
              <p className="notice notice-warning">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  {data.late_reviews} {data.late_reviews === 1 ? 'booking has' : 'bookings have'} waited longer than your review target. Their slots stay reserved until someone decides.{' '}
                  <button type="button" className="btn-link" onClick={() => onView({ status: 'pending' })}>
                    Review pending bookings
                  </button>
                </span>
              </p>
            )}
            {data.email_issues > 0 && (
              <p className="notice notice-warning">
                <MailWarning size={18} aria-hidden="true" />
                <span>
                  {data.email_issues} {data.email_issues === 1 ? 'email needs' : 'emails need'} a delivery check.{' '}
                  <button type="button" className="btn-link" onClick={() => onNavigate('notifications')}>
                    Open email delivery
                  </button>
                </span>
              </p>
            )}

            <div className="ops-overview-grid">
              <section aria-labelledby="ops-next-title">
                <div className="ops-section-head">
                  <h2 id="ops-next-title">Needs your action</h2>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onView({ view: 'mine' })}>
                    My assigned work
                  </button>
                </div>
                {queue.length ? (
                  <ActionRows rows={queue} onOpen={onOpen} />
                ) : (
                  <div className="ops-booking-list">
                    <EmptyState icon={CalendarRange} title="You’re all caught up">
                      New bookings, payments and requests will appear here.
                    </EmptyState>
                  </div>
                )}
              </section>

              <aside className="ops-side" aria-label="Schedule">
                <section className="ops-panel ops-schedule">
                  <h2>Today’s schedule</h2>
                  <ErrorBox error={week.error} />
                  {todays.length ? (
                    <ol className="ops-timeline">
                      {todays.map((b) => (
                        <li key={b.id}>
                          <button type="button" onClick={() => onOpen(b.id)}>
                            <time>{formatClock(b.start_time)}</time>
                            <span>
                              <strong>{b.full_name}</strong>
                              <small>
                                {b.service} · until {formatClock(b.end_time)}
                              </small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="ops-muted">{week.loading ? 'Loading…' : 'No shoots today.'}</p>
                  )}
                </section>
                <section className="ops-panel ops-schedule">
                  <h2>Coming up this week</h2>
                  {upcoming.length ? (
                    <ol className="ops-timeline">
                      {upcoming.map((b) => (
                        <li key={b.id}>
                          <button type="button" onClick={() => onOpen(b.id)}>
                            <time>{formatDayShort(b.booking_date)}</time>
                            <span>
                              <strong>{b.full_name}</strong>
                              <small>
                                {b.service} · {formatTimeRange(b.start_time, b.end_time)}
                              </small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="ops-muted">{week.loading ? 'Loading…' : 'Nothing else booked in the next seven days.'}</p>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={() => onView({ view: 'week' })}>
                    See the next seven days
                  </button>
                </section>
              </aside>
            </div>
          </>
        )
      )}
    </>
  );
}
