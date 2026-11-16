import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Download, List, Search, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { csv, download, rpc, useResource } from '../../../lib/studio';
import type { SessionUser } from '../../../lib/session';
import BookingWorkspace from '../../studio/BookingWorkspace';
import { todayKey } from '../shared';
import CalendarPanel from './CalendarPanel';
import type { BookingPreset } from './OverviewView';
import { BookingRows, EmptyState, ErrorBox, Loading, PageHead, Pagination, type BookingTab, type Row } from './ui';

export const VIEW_OPTIONS: [string, string][] = [
  ['', 'All bookings'],
  ['today', 'Today'],
  ['week', 'Next 7 days'],
  ['mine', 'My work'],
  ['payments', 'Payment review'],
  ['requests', 'Client requests'],
  ['unassigned', 'Unassigned'],
  ['overdue', 'Overdue delivery'],
  ['awaiting_client', 'Awaiting client'],
];
const STATUS_OPTIONS: [string, string][] = [
  ['', 'All statuses'],
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];
const PAGE_SIZE = 25;

type Filters = { view?: string; status?: string; from?: string; to?: string; archive?: string; sort?: string; q?: string };
const fromPreset = (preset: BookingPreset): Filters => ({ view: preset.view || '', status: preset.status || '' });

export default function BookingsView({
  user,
  revision,
  preset,
  mode,
  focusId,
  focusTab,
  onOpenChange,
}: {
  user: SessionUser;
  revision: number;
  preset: { key: number; filters: BookingPreset };
  mode: 'bookings' | 'payments';
  focusId?: string | null;
  focusTab?: BookingTab;
  onOpenChange: (id: string | null) => void;
}) {
  const [filters, setFilters] = useState<Filters>(() => fromPreset(preset.filters));
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(focusId || null);
  const [calendar, setCalendar] = useState(false);
  const [showFilters, setShowFilters] = useState(() => typeof window !== 'undefined' && window.innerWidth > 960);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [saveName, setSaveName] = useState('');
  const filterKey = JSON.stringify(filters);

  const { data, error: loadError, refresh } = useResource<{ rows: Row[]; total: number }>(() => rpc('studio_booking_page', { p_filters: filters, p_page: page, p_size: PAGE_SIZE }), [filterKey, page, revision]);
  const views = useResource(async () => {
    const { data, error } = await supabase.from('studio_saved_views').select('*').order('name');
    if (error) throw error;
    return data as Row[];
  }, []);

  // A sidebar link or an Overview card always starts from its own view.
  const firstPreset = useRef(true);
  useEffect(() => {
    if (firstPreset.current) {
      firstPreset.current = false;
      return;
    }
    setSelected(null);
    setFilters(fromPreset(preset.filters));
    setQuery('');
    setPage(0);
    setCalendar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.key]);

  useEffect(() => {
    if (focusId) {
      setSelected(focusId);
      onOpenChange(focusId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.q === query || (!current.q && !query) ? current : { ...current, q: query }));
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const update = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  };
  const open = (id: string | null) => {
    setSelected(id);
    onOpenChange(id);
  };
  const activeFilters = [filters.status, filters.from, filters.to, filters.archive && filters.archive !== 'active' ? filters.archive : '', filters.sort].filter(Boolean).length;

  const exportRows = async () => {
    setExporting(true);
    setError('');
    try {
      const result = await rpc<Row[]>('studio_export_bookings', { p_filters: filters });
      download(
        `studio-bookings-${todayKey()}.csv`,
        csv([
          ['Reference', 'Client', 'Email', 'Service', 'Shoot date', 'Start (Manila)', 'End (Manila)', 'Status', 'Payment', 'Gallery', 'Total PHP', 'Verified payments PHP', 'Refunds PHP', 'Delivery due'],
          ...result.map((b) => [b.id, b.full_name, b.email, b.service, b.booking_date, b.start_time, b.end_time, b.status, b.payment_state, b.gallery_status, b.total_price, b.paid_amount, b.refunded_amount, b.delivery_due]),
        ]),
        'text/csv'
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const saveView = async () => {
    const { error } = await supabase.from('studio_saved_views').upsert({ user_id: user.id, name: saveName.trim(), filters }, { onConflict: 'user_id,name' });
    if (error) setError(error.message);
    else {
      setSaveName('');
      await views.refresh();
    }
  };

  if (selected) return <BookingWorkspace key={`${selected}-${focusTab || ''}`} id={selected} user={user} team revision={revision} initialTab={focusTab} onClose={() => open(null)} onChanged={() => void refresh()} />;

  const payments = mode === 'payments';
  const total = data?.total ?? 0;

  return (
    <>
      <PageHead
        eyebrow={payments ? 'Money & receipts' : 'Reservations & production'}
        title={payments ? 'Payments' : 'Bookings'}
        description={payments ? 'Check each GCash receipt against money received in the studio account, then verify it on the booking.' : 'One place for schedules, payments, preparation and delivery.'}
        actions={
          <>
            <div className="ops-segmented" role="group" aria-label="Show bookings as">
              <button type="button" aria-pressed={!calendar} className={!calendar ? 'is-active' : ''} onClick={() => setCalendar(false)}>
                <List size={16} aria-hidden="true" /> List
              </button>
              <button type="button" aria-pressed={calendar} className={calendar ? 'is-active' : ''} onClick={() => setCalendar(true)}>
                <CalendarDays size={16} aria-hidden="true" /> Calendar
              </button>
            </div>
            {user.role !== 'staff' && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={exporting} onClick={() => void exportRows()}>
                <Download size={16} aria-hidden="true" /> {exporting ? 'Preparing…' : 'Export CSV'}
              </button>
            )}
          </>
        }
      />

      {calendar ? (
        <CalendarPanel revision={revision} onOpen={(id) => open(id)} />
      ) : (
        <>
          <div className="ops-chips" role="group" aria-label="Booking views">
            {VIEW_OPTIONS.map(([value, title]) => (
              <button key={value} type="button" aria-pressed={(filters.view || '') === value} className={(filters.view || '') === value ? 'is-active' : ''} onClick={() => update('view', value)}>
                {title}
              </button>
            ))}
          </div>

          <div className="ops-toolbar">
            <label className="studio-search">
              <Search size={18} aria-hidden="true" />
              <input type="search" aria-label="Search bookings" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client, email, service or reference" />
            </label>
            <button type="button" className={`btn btn-secondary btn-sm ops-filter-toggle ${showFilters ? 'is-open' : ''}`} aria-expanded={showFilters} aria-controls="ops-booking-filters" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal size={16} aria-hidden="true" /> Filters
              {activeFilters > 0 && <span className="ops-count">{activeFilters}</span>}
            </button>
          </div>

          {showFilters && (
            <section className="ops-panel ops-filters" id="ops-booking-filters" aria-label="Filters">
              <div className="ops-filter-grid">
                <label>
                  Status
                  <select value={filters.status || ''} onChange={(e) => update('status', e.target.value)}>
                    {STATUS_OPTIONS.map(([value, title]) => (
                      <option key={value} value={value}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Shoot from
                  <input type="date" value={filters.from || ''} onChange={(e) => update('from', e.target.value)} />
                </label>
                <label>
                  Shoot until
                  <input type="date" value={filters.to || ''} onChange={(e) => update('to', e.target.value)} />
                </label>
                <label>
                  Records
                  <select value={filters.archive || 'active'} onChange={(e) => update('archive', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="all">All records</option>
                  </select>
                </label>
                <label>
                  Sort by
                  <select value={filters.sort || ''} onChange={(e) => update('sort', e.target.value)}>
                    <option value="">Newest request</option>
                    <option value="shoot">Shoot date</option>
                  </select>
                </label>
              </div>
              <div className="ops-saved-views">
                <label>
                  Saved view
                  <select
                    value=""
                    onChange={(e) => {
                      const view = views.data?.find((v) => v.id === e.target.value);
                      if (view) {
                        setFilters(view.filters);
                        setQuery(view.filters.q || '');
                        setPage(0);
                      }
                    }}
                  >
                    <option value="">{views.data?.length ? 'Choose a saved view' : 'No saved views yet'}</option>
                    {views.data?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Save these filters as
                  <input placeholder="e.g. This month’s weddings" maxLength={60} value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                </label>
                <button type="button" className="btn btn-secondary btn-sm" disabled={!saveName.trim()} onClick={() => void saveView()}>
                  Save view
                </button>
                {activeFilters > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setFilters((current) => ({ view: current.view, q: current.q }));
                      setPage(0);
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </section>
          )}

          <ErrorBox error={error || loadError} />
          {data ? (
            <>
              <p className="ops-result-count" role="status">
                {total === 1 ? '1 booking' : `${total} bookings`}
              </p>
              <BookingRows
                rows={data.rows}
                onOpen={(id) => open(id)}
                empty={
                  <EmptyState title={filters.q ? 'No bookings match your search' : 'Nothing here right now'}>
                    {filters.q ? 'Check the spelling, or search by email or reference.' : 'Try another view, or clear the filters.'}
                  </EmptyState>
                }
              />
              <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} hasNext={(page + 1) * PAGE_SIZE < total} onPage={setPage} />
            </>
          ) : (
            !loadError && <Loading>Loading bookings…</Loading>
          )}
        </>
      )}
    </>
  );
}
