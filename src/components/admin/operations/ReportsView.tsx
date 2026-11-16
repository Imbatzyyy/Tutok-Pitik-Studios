import { useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText } from 'lucide-react';
import { SERVICES } from '../../../content/site';
import { exportReportPdf } from '../../../lib/pdf';
import { csv, download, formatDay, formatMonth, label, money, rpc, useResource } from '../../../lib/studio';
import { addDaysKey, todayKey } from '../shared';
import { BarChart, EmptyState, ErrorBox, Loading, MixBars, PageHead, type Row } from './ui';

const monthsBetween = (from: string, to: string) => {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endKey = to.slice(0, 7);
  while (months.length < 40) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key >= endKey) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
};

const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export default function ReportsView({ revision }: { revision: number }) {
  const today = todayKey();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(addDaysKey(30));
  const [service, setService] = useState('');
  const invalid = !from || !to ? 'Choose both dates.' : to < from ? 'The end date must be on or after the start date.' : '';

  const { data, error, loading } = useResource<Row | null>(() => (invalid ? Promise.resolve(null) : rpc('studio_finance_report', { p_from: from, p_to: to, p_service: service })), [from, to, service, revision, invalid]);

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const ranges: [string, string, string][] = [
    ['This month', `${today.slice(0, 7)}-01`, `${today.slice(0, 7)}-${lastDayOf(year, month)}`],
    ['Next 30 days', today, addDaysKey(30)],
    ['Last 3 months', addDaysKey(-90), today],
    ['This year', `${year}-01-01`, `${year}-12-31`],
  ];

  const exportCsv = () => {
    if (!data) return;
    download(
      `studio-report-${from}-${to}.csv`,
      csv([
        ['Tutok Pitik Studios report', 'Shoot date range', from, to, 'Service', service || 'All'],
        ['Metric', 'Value'],
        ...Object.entries(data)
          .filter(([, value]) => !Array.isArray(value))
          .map(([key, value]) => [label(key), value]),
        [],
        ['Service', 'Bookings', 'Booked value PHP'],
        ...data.by_service.map((s: Row) => [s.service, s.bookings, s.booked_value]),
      ]),
      'text/csv'
    );
  };

  const monthly = data ? monthsBetween(from, to).map((key) => ({ label: formatMonth(key), value: Number(data.monthly.find((m: Row) => m.month === key)?.bookings) || 0 })) : [];
  const services = data ? [...data.by_service].sort((a: Row, b: Row) => (Number(b.booked_value) || 0) - (Number(a.booked_value) || 0)) : [];

  return (
    <>
      <PageHead
        eyebrow="How the studio is doing"
        title="Reports"
        description="Filtered by shoot date. Money figures come from payments the studio has verified. They are not a bank statement or a profit figure."
        actions={
          <>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!data} onClick={exportCsv}>
              <Download size={16} aria-hidden="true" /> Export CSV
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!data} onClick={() => data && void exportReportPdf(data, from, to, service).catch(() => toast.error('Could not create the report PDF'))}>
              <FileText size={16} aria-hidden="true" /> Download PDF
            </button>
          </>
        }
      />

      <section className="ops-panel ops-filters" aria-label="Report period">
        <div className="ops-chips ops-chips-tight" role="group" aria-label="Quick periods">
          {ranges.map(([title, start, end]) => (
            <button
              key={title}
              type="button"
              aria-pressed={from === start && to === end}
              className={from === start && to === end ? 'is-active' : ''}
              onClick={() => {
                setFrom(start);
                setTo(end);
              }}
            >
              {title}
            </button>
          ))}
        </div>
        <div className="ops-filter-grid">
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label>
            Service
            <select value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">All services</option>
              {SERVICES.map((s) => (
                <option key={s.id} value={s.title}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="ops-muted">
          {from && to && !invalid ? `${formatDay(from)} to ${formatDay(to)}` : ''}
        </p>
      </section>

      <ErrorBox error={invalid || error} />
      {loading && !data && !invalid ? (
        <Loading>Building your report…</Loading>
      ) : (
        data && (
          <>
            <div className="ops-metrics">
              {[
                ['booked_value', 'Booked value'],
                ['deposits', 'Verified deposits'],
                ['final_payments', 'Final payments'],
                ['refunds', 'Recorded refunds'],
                ['outstanding', 'Outstanding'],
              ].map(([key, title]) => (
                <div key={key} className="ops-metric is-static">
                  <small>{title}</small>
                  <strong>{money(data[key])}</strong>
                </div>
              ))}
            </div>

            <div className="ops-grid">
              <section className="ops-panel">
                <h2>Bookings per month</h2>
                {monthly.some((m) => m.value) ? <BarChart title="Bookings per month" data={monthly} format={(v) => (v === 1 ? '1 booking' : `${v} bookings`)} /> : <p className="ops-muted">No bookings in this period.</p>}
              </section>
              <section className="ops-panel">
                <h2>Service mix</h2>
                {services.length ? (
                  <MixBars
                    data={services.map((s: Row) => ({ label: s.service, value: Number(s.booked_value) || 0, note: Number(s.bookings) === 1 ? '1 booking' : `${s.bookings} bookings` }))}
                    format={money}
                  />
                ) : (
                  <p className="ops-muted">No bookings in this period.</p>
                )}
              </section>
            </div>

            <section className="ops-panel">
              <h2>Performance</h2>
              <dl className="ops-stats">
                <div>
                  <dt>Bookings</dt>
                  <dd>{data.bookings}</dd>
                </div>
                <div>
                  <dt>Cancelled</dt>
                  <dd>{data.cancelled}</dd>
                </div>
                <div>
                  <dt>Repeat clients</dt>
                  <dd>{data.repeat_clients}</dd>
                </div>
                <div>
                  <dt>Average payment review</dt>
                  <dd>{data.avg_review_hours == null ? 'Not enough data' : `${data.avg_review_hours} hours`}</dd>
                </div>
              </dl>
            </section>

            <section className="ops-panel">
              <h2>Team workload</h2>
              {data.workload?.length ? (
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th scope="col">Team member</th>
                        <th scope="col">Shoots</th>
                        <th scope="col">Editing</th>
                        <th scope="col">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.workload.map((w: Row) => (
                        <tr key={w.full_name}>
                          <td>{w.full_name}</td>
                          <td>{w.shoots}</td>
                          <td>{w.editing}</td>
                          <td>{w.overdue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No assignments in this period">Assign photographers and editors on each booking to see workload here.</EmptyState>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
