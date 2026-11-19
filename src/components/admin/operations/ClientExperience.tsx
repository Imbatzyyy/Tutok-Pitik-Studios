import { useState } from 'react';
import { SERVICES } from '../../../content/site';
import { formatStamp, rpc, useResource } from '../../../lib/studio';
import { ErrorBox, Loading } from './ui';

type Segment = {
  service: string;
  device: string | null;
  source: string | null;
  total: number;
};
interface Experience {
  opened_pending: number;
  oldest_proof: string | null;
  payment_cases: number;
  decision: { sample: number; median: number | null; p90: number | null };
  follow_up: {
    id: string;
    service: string;
    created_at: string;
    owner: string;
  }[];
  visits: (Segment & { stage: string })[];
  confirmed: Segment[];
  inquiries: (Segment & { qualified: number; booked: number })[];
}

export default function ClientExperience({ revision }: { revision: number }) {
  const { data, error } = useResource<Experience>(
    () => rpc('studio_client_experience'),
    [revision],
  );
  const [device, setDevice] = useState('');
  const [source, setSource] = useState('');
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading>Loading booking experience…</Loading>;
  const matches = (row: Segment) =>
    (!device || row.device === device) && (!source || row.source === source);
  const hours = (n: number | null) => (n === null ? '—' : n.toFixed(1) + ' h');
  const perHundred = (count: number, views: number) =>
    views ? ((100 * count) / views).toFixed(1) : '—';
  return (
    <section className="ops-panel">
      <h2>Booking experience</h2>
      <div className="ops-metrics">
        <div className="ops-metric">
          <small>Opened and awaiting a decision</small>
          <strong>{data.opened_pending}</strong>
        </div>
        <div className="ops-metric">
          <small>Oldest unreviewed proof</small>
          <strong>
            {data.oldest_proof ? formatStamp(data.oldest_proof) : 'None'}
          </strong>
        </div>
        <div className="ops-metric">
          <small>Open GCash cases</small>
          <strong>
            <a href="/admin/inbox">{data.payment_cases}</a>
          </strong>
        </div>
      </div>
      {data.follow_up.length > 0 && (
        <ul>
          {data.follow_up.map((b) => (
            <li key={b.id}>
              <a href={'/admin/bookings/' + b.id}>{b.service}</a> ·{' '}
              {formatStamp(b.created_at)} · {b.owner}
            </li>
          ))}
        </ul>
      )}
      <h3>Last 30 days</h3>
      <p>
        First team decision on {data.decision.sample} bookings. Median{' '}
        {hours(data.decision.median)} · 90th percentile{' '}
        {hours(data.decision.p90)}.
      </p>
      <div className="ops-filter-grid">
        <label>
          Device
          <select value={device} onChange={(e) => setDevice(e.target.value)}>
            <option value="">All devices</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
        </label>
        <label>
          Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {['direct', 'search', 'social', 'referral'].map((s) => (
              <option value={s} key={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Visits count service selections and service or session page views.
        Qualified inquiries are marked working, replied or booked. Rates include
        bookings started elsewhere on the site. Older or opted-out bookings
        appear only in the unfiltered totals.
      </p>
      <div
        style={{ overflowX: 'auto' }}
        tabIndex={0}
        role="region"
        aria-label="Booking activity by service"
      >
        <table className="ops-table">
          <thead>
            <tr>
              {[
                'Service',
                'Views',
                'Packages',
                'Sign-in returns',
                'Holds',
                'Proofs submitted',
                'Submission errors',
                'Inquiries',
                'Qualified per 100 views',
                'Booked leads',
                'Confirmed',
                'Confirmed per 100 views',
              ].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SERVICES.map((service) => {
              const visits = data.visits.filter(
                (r) => matches(r) && r.service === service.id,
              );
              const steps = (stage: string) =>
                visits
                  .filter((r) => r.stage === stage)
                  .reduce((n, r) => n + r.total, 0);
              const leads = data.inquiries.filter(
                (r) => matches(r) && r.service === service.id,
              );
              const confirmed = data.confirmed
                .filter((r) => matches(r) && r.service === service.title)
                .reduce((n, r) => n + r.total, 0);
              return (
                <tr key={service.id}>
                  <th>{service.title}</th>
                  {[
                    'service_view',
                    'package',
                    'signup_return',
                    'slot',
                    'submitted',
                    'retry_failed',
                  ].map((s) => (
                    <td key={s}>{steps(s)}</td>
                  ))}
                  <td>{leads.reduce((n, r) => n + r.total, 0)}</td>
                  <td>
                    {perHundred(
                      leads.reduce((n, r) => n + r.qualified, 0),
                      steps('service_view'),
                    )}
                  </td>
                  <td>{leads.reduce((n, r) => n + r.booked, 0)}</td>
                  <td>{confirmed}</td>
                  <td>{perHundred(confirmed, steps('service_view'))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
