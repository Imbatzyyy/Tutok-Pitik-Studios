import { useEffect, useState } from 'react';
import { Mail, Phone, Search, UserRound } from 'lucide-react';
import { formatDay, rpc, useResource } from '../../../lib/studio';
import { initials as initialsOf } from '../../../lib/format';
import { BookingRows, EmptyState, ErrorBox, Loading, PageHead, Pagination, type OpenBooking, type Row } from './ui';

const PAGE_SIZE = 24;

export default function ClientsView({ revision, onOpen }: { revision: number; onOpen: OpenBooking }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [client, setClient] = useState<Row | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const { data, error } = useResource<{ rows: Row[]; total: number }>(() => rpc('studio_clients', { p_query: query, p_page: page }), [query, page, revision]);
  const history = useResource<{ rows: Row[]; total: number }>(
    () => (client ? rpc('studio_booking_page', { p_filters: { customer: client.user_id, archive: 'all', sort: 'shoot' }, p_size: 100 }) : Promise.resolve({ rows: [], total: 0 })),
    [client?.user_id, revision]
  );

  return (
    <>
      <PageHead eyebrow="The people behind the moments" title="Clients" description="Everyone who has booked a session, with their contact details and booking history." />
      <label className="studio-search ops-search-wide">
        <Search size={18} aria-hidden="true" />
        <input type="search" aria-label="Find a client" placeholder="Search by name or email" value={input} onChange={(e) => setInput(e.target.value)} />
      </label>
      <ErrorBox error={error} />
      <div className="ops-grid ops-grid-clients">
        <section className="ops-panel ops-client-list" aria-label="Clients">
          {!data ? (
            !error && <Loading>Loading clients…</Loading>
          ) : data.rows.length ? (
            <>
              <p className="ops-result-count">{data.total === 1 ? '1 client' : `${data.total} clients`}</p>
              <ul>
                {data.rows.map((c) => (
                  <li key={c.user_id}>
                    <button type="button" className={`ops-client ${client?.user_id === c.user_id ? 'is-selected' : ''}`} aria-pressed={client?.user_id === c.user_id} onClick={() => setClient(c)}>
                      <span className="ops-avatar" aria-hidden="true">
                        {initialsOf(c.full_name)}
                      </span>
                      <span>
                        <strong>{c.full_name}</strong>
                        <small>{c.email}</small>
                        <small>
                          {c.bookings} {Number(c.bookings) === 1 ? 'booking' : 'bookings'}
                          {c.last_shoot ? ` · Latest shoot ${formatDay(c.last_shoot)}` : ''}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={page} pageCount={Math.max(1, Math.ceil(data.total / PAGE_SIZE))} hasNext={(page + 1) * PAGE_SIZE < data.total} onPage={setPage} />
            </>
          ) : (
            <EmptyState icon={UserRound} title={query ? 'No matching clients' : 'No clients yet'}>
              {query ? 'Try a different name or email.' : 'Clients appear here after their first reservation.'}
            </EmptyState>
          )}
        </section>

        <section className="ops-panel ops-client-detail" aria-live="polite">
          {client ? (
            <>
              <div className="ops-client-head">
                <span className="ops-avatar ops-avatar-lg" aria-hidden="true">
                  {initialsOf(client.full_name)}
                </span>
                <div>
                  <h2>{client.full_name}</h2>
                  <p className="ops-muted">{client.bookings} {Number(client.bookings) === 1 ? 'booking' : 'bookings'}</p>
                </div>
              </div>
              <div className="ops-contact-actions">
                <a className="btn btn-secondary btn-sm" href={`mailto:${client.email}`}>
                  <Mail size={16} aria-hidden="true" /> {client.email}
                </a>
                {client.phone && (
                  <a className="btn btn-secondary btn-sm" href={`tel:${client.phone}`}>
                    <Phone size={16} aria-hidden="true" /> {client.phone}
                  </a>
                )}
              </div>
              <h3>Booking history</h3>
              <ErrorBox error={history.error} />
              {history.data ? <BookingRows rows={history.data.rows} onOpen={onOpen} /> : <Loading>Loading bookings…</Loading>}
              {(history.data?.total || 0) > 100 && <p className="ops-muted">Showing the first 100 bookings. Use Bookings to search older records.</p>}
            </>
          ) : (
            <EmptyState icon={UserRound} title="Select a client">
              Their contact details and every booking will show here.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
