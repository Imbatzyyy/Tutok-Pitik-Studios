// In-memory Supabase stand-in for local testing (VITE_DEMO_MODE=true only).
// It understands the small subset of Auth, PostgREST, RPC, Storage and the
// edge-function routes this site uses. Never bundled in production builds.

type Row = Record<string, any>;
interface DemoAccount {
  id: string;
  email: string;
  password: string;
  user_metadata: Row;
  created_at: string;
}
interface DemoDb {
  accounts: DemoAccount[];
  tables: Record<string, Row[]>;
}

const STORAGE_KEY = 'tps-demo-db-v2';
const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString();
const uuid = () => (crypto as any).randomUUID?.() || `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
const meta = (data: Row) => `\n\n---BOOKING_META---\n${JSON.stringify(data)}`;
const RECEIPT = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" fill="#0b57d0"/><text x="150" y="200" fill="#fff" font-size="28" font-family="Arial" text-anchor="middle">GCash</text><text x="150" y="240" fill="#fff" font-size="16" font-family="Arial" text-anchor="middle">Demo receipt</text></svg>')}`;

const seed = (): DemoDb => {
  const accounts: DemoAccount[] = [
    { id: 'u-super', email: 'superadmin@demo.test', password: 'demo1234', user_metadata: { full_name: 'Demo Superadmin' }, created_at: iso(-300) },
    { id: 'u-admin', email: 'admin@demo.test', password: 'demo1234', user_metadata: { full_name: 'Demo Admin' }, created_at: iso(-200) },
    { id: 'u-staff', email: 'staff@demo.test', password: 'demo1234', user_metadata: { full_name: 'Demo Staff' }, created_at: iso(-150) },
    { id: 'u-cust', email: 'customer@demo.test', password: 'demo1234', user_metadata: { full_name: 'Demo Customer', username: 'democustomer' }, created_at: iso(-90) },
    { id: 'u-cust2', email: 'nophone@demo.test', password: 'demo1234', user_metadata: { full_name: 'No Phone Customer', username: 'nophone' }, created_at: iso(-10) },
  ];
  const users = accounts.map((account) => ({
    id: account.id,
    email: account.email,
    full_name: account.user_metadata.full_name,
    username: account.user_metadata.username || null,
    phone: account.id === 'u-cust' ? '0917 000 0000' : null,
    role: account.id === 'u-super' ? 'superadmin' : account.id === 'u-admin' ? 'admin' : account.id === 'u-staff' ? 'staff' : 'customer',
    status: 'active',
    profile_picture_url: null,
    created_at: account.created_at,
    updated_at: account.created_at,
  }));
  const booking = (id: string, offset: number, status: string, service: string, rate: number, start: string, end: string, extra: Row = {}) => {
    const hours = Number(end.slice(0, 2)) - Number(start.slice(0, 2));
    const subtotal = rate * hours;
    return {
      id,
      user_id: extra.user_id || 'u-cust',
      full_name: extra.full_name || 'Demo Customer',
      email: extra.email || 'customer@demo.test',
      phone: '0917 000 0000',
      service,
      booking_date: day(offset),
      start_time: `${start}:00`,
      end_time: `${end}:00`,
      duration: hours,
      price: rate,
      transportation_fee: extra.transportation_fee || 0,
      total_price: subtotal + (extra.transportation_fee || 0),
      location: extra.location || 'Tomas Morato Ave, Quezon City',
      status,version:1,archived_at:null,assigned_to:status==='confirmed'?'u-staff':null,editor_id:'u-admin',support_ids:[],delivery_due:status==='completed'?day(-2):day(offset+14),checklist:{contact:true},preparation:{style:'Natural light and candid moments',venue_contact:'Demo venue coordinator'},needs_information:false,paid_amount:status==='pending'?0:subtotal/2,refunded_amount:0,payment_state:status==='pending'?'under_review':'deposit_verified',gallery_status:status==='completed'?'editing':'not_started',gallery_url:'',client_note:'',
      message: `${extra.note || ''}${meta({
        paymentMethod: 'GCash',
        paymentReference: `90${id.replace(/\D/g, '').padEnd(8, '7')}`,
        paymentReceiptUrl: RECEIPT,
        paymentReceiptName: 'gcash-receipt.png',
        paymentStatus: extra.paymentStatus || (status === 'pending' ? 'submitted' : status === 'cancelled' ? 'rejected' : 'verified'),
        paymentSubmittedAt: iso(offset - 7),
        downpaymentAmount: subtotal / 2,
        ...(extra.meta || {}),
      })}`,
      created_at: iso(Math.min(offset - 7, -1)),
      updated_at: iso(-1),
    };
  };
  return {
    accounts,
    tables: {
      users,
      bookings: [
        booking('b-1001', 3, 'pending', 'Birthday Photography', 1000, '14', '18', { note: 'First birthday party, around 40 guests.' }),
        booking('b-1002', 6, 'confirmed', 'Portrait Photography', 2500, '09', '11', { transportation_fee: 350 }),
        booking('b-1003', -12, 'completed', 'Event Coverage', 1500, '13', '18', { meta: { photoStatus: 'delivered', driveLink: 'https://drive.google.com/drive/folders/demo', completedAt: iso(-10) } }),
        booking('b-1004', -30, 'cancelled', 'Commercial Photography', 4000, '10', '12', { note: 'Product shoot for a cafe menu.' }),
        booking('b-1005', 10, 'pending', 'Event Coverage', 1500, '08', '13', { user_id: 'u-cust2', full_name: 'No Phone Customer', email: 'nophone@demo.test' }),
        booking('b-1006', 6, 'confirmed', 'Event Coverage', 1500, '14', '19', { user_id: 'u-cust2', full_name: 'No Phone Customer', email: 'nophone@demo.test' }),
      ],
      portfolio_images: [],
      favorites: [],
      testimonials: [
        { id: 't-1', client_name: 'Demo Client A', client_context: 'Birthday · demo data', quote: 'Demo testimonial text used only for local testing.', rating: 5, is_published: true, display_order: 0, created_at: iso(-20) },
        { id: 't-2', client_name: 'Demo Client B', client_context: 'Portrait · demo data', quote: 'Another demo testimonial for local testing only.', rating: 5, is_published: true, display_order: 1, created_at: iso(-15) },
        { id: 't-3', client_name: 'Hidden Demo', client_context: 'Unpublished', quote: 'This one is unpublished and should not show on the site.', rating: 4, is_published: false, display_order: 2, created_at: iso(-5) },
      ],
      blocked_dates: [
        { id: 'bd-1', blocked_date: day(4), reason: 'Studio day off', created_at: iso(-3) },
        { id: 'bd-2', blocked_date: day(12), reason: 'Out of town shoot', created_at: iso(-3) },
      ],
      contact_messages: [],
    },
  };
};

const load = (): DemoDb => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return seed();
};

const b64 = (value: Row) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const makeToken = (account: DemoAccount) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: account.id, email: account.email, role: 'authenticated', aud: 'authenticated', exp })}.demo`;
};
const parseToken = (token?: string | null) => {
  try {
    const payload = token?.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const parseValue = (raw: string) => {
  const value = decodeURIComponent(raw).replace(/^"|"$/g, '');
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  return value;
};

const matches = (row: Row, column: string, expression: string) => {
  const dot = expression.indexOf('.');
  const op = expression.slice(0, dot);
  const rawValue = expression.slice(dot + 1);
  const cell = row[column];
  const compare = (value: any) => (typeof cell === 'number' ? Number(value) : value);
  switch (op) {
    case 'eq':
      return String(cell) === String(parseValue(rawValue));
    case 'neq':
      return String(cell) !== String(parseValue(rawValue));
    case 'in': {
      const list = decodeURIComponent(rawValue).replace(/^\(|\)$/g, '').split(',').map((item) => item.replace(/^"|"$/g, ''));
      return list.includes(String(cell));
    }
    case 'gte':
      return cell >= compare(parseValue(rawValue));
    case 'lte':
      return cell <= compare(parseValue(rawValue));
    case 'gt':
      return cell > compare(parseValue(rawValue));
    case 'lt':
      return cell < compare(parseValue(rawValue));
    case 'is':
      return rawValue === 'null' ? cell === null || cell === undefined : String(cell) === rawValue;
    default:
      return true;
  }
};

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

export function createDemoFetch(supabaseUrl: string): typeof fetch {
  const db = load();
  db.tables.studio_settings=[{id:true,opens_at:'08:00',closes_at:'20:00',buffer_before:15,buffer_after:15,max_hours:8,lead_days:1,delivery_days:14,review_hours:48,owner_notice_hours:2}];
  db.tables.booking_payments ||= db.tables.bookings.map(b=>({id:'p-'+b.id,booking_id:b.id,kind:'deposit',amount:b.price*b.duration/2,method:'GCash',reference:'DEMO-'+b.id,status:b.status==='pending'?'pending':'verified',source:'legacy',reason:'Fictional preview payment',created_at:b.created_at}));
  db.tables.booking_notes ||= [{id:'note1',booking_id:'b-1001',internal:false,body:'Please confirm the entrance and parking arrangements.',author_name:'Demo studio',author_role:'admin',created_at:iso(-1)}];
  db.tables.studio_notifications ||= [{id:1,user_id:'u-super',booking_id:'b-1001',title:'A payment proof needs review',created_at:iso(0),read_at:null}];
  db.tables.studio_operations ||= [{key:'backup',state:'preview',detail:'Fictional local preview. No live backup has run here.',checked_at:iso(0)}];
  const save = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* quota: ignore */
    }
  };
  const table = (name: string) => (db.tables[name] ||= []);
  const userFor = (account: DemoAccount) => ({
    id: account.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: account.email,
    email_confirmed_at: account.created_at,
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: account.user_metadata,
    identities: [],
    created_at: account.created_at,
    updated_at: account.created_at,
  });
  const sessionFor = (account: DemoAccount) => ({
    access_token: makeToken(account),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${account.id}`,
    user: userFor(account),
  });
  const currentAccount = (headers: Headers) => {
    const token = headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const claims = parseToken(token);
    return claims?.sub ? db.accounts.find((account) => account.id === claims.sub) || null : null;
  };
  const roleOf = (account: DemoAccount | null) => (account ? table('users').find((row) => row.id === account.id)?.role : undefined);

  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const headers = request.headers;
    const bodyText = method === 'GET' || method === 'HEAD' ? '' : await request.text();
    const body = bodyText ? (() => { try { return JSON.parse(bodyText); } catch { return bodyText; } })() : undefined;

    await new Promise((resolve) => setTimeout(resolve, 120));

    if (url.pathname === '/.netlify/functions/admin-login') {
      const account = db.accounts.find(entry => entry.email === body?.email && entry.password === body?.password);
      if (!account || !['superadmin','admin','staff'].includes(roleOf(account))) return json({error:'Unable to sign in with these details.'},401);
      return json(sessionFor(account));
    }
    if (!url.href.startsWith(supabaseUrl)) {
      return fetch(input, init);
    }
    const path = url.pathname;

    if (/\/users\/[^/]+\/password-reset$/.test(path)&&method==='POST')return roleOf(currentAccount(headers))==='superadmin'?json({success:true}):json({error:'Superadmin access required'},403);
    if (path === '/rest/v1/rpc/is_studio_team') return json(['superadmin','admin','staff'].includes(roleOf(currentAccount(headers))));
    if (path === '/rest/v1/rpc/studio_end_admin_session') return json(null);
    // ---------------- Auth ----------------
    if (path.startsWith('/auth/v1/')) {
      const route = path.replace('/auth/v1/', '');
      if (route === 'token') {
        const grant = url.searchParams.get('grant_type');
        if (grant === 'password') {
          const account = db.accounts.find((entry) => entry.email.toLowerCase() === String(body?.email || '').toLowerCase());
          if (!account || account.password !== body?.password) {
            return json({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' }, 400);
          }
          return json(sessionFor(account));
        }
        if (grant === 'refresh_token') {
          const account = db.accounts.find((entry) => `refresh-${entry.id}` === body?.refresh_token);
          return account ? json(sessionFor(account)) : json({ error: 'invalid_grant', msg: 'Invalid refresh token' }, 400);
        }
      }
      if (route === 'signup') {
        if (db.accounts.some((entry) => entry.email.toLowerCase() === String(body?.email || '').toLowerCase())) {
          return json({ code: 'user_already_exists', msg: 'User already registered' }, 422);
        }
        const account: DemoAccount = { id: uuid(), email: body.email, password: body.password, user_metadata: body.data || {}, created_at: new Date().toISOString() };
        db.accounts.push(account);
        table('users').push({
          id: account.id,
          email: account.email,
          full_name: account.user_metadata.full_name || 'User',
          username: account.user_metadata.username || null,
          phone: account.user_metadata.phone || null,
          role: 'customer',
          status: 'active',
          created_at: account.created_at,
          updated_at: account.created_at,
        });
        save();
        return json({ ...userFor(account), email_confirmed_at: null, confirmation_sent_at: new Date().toISOString() });
      }
      if (route === 'user') {
        const account = currentAccount(headers);
        if (!account) return json({ code: 'bad_jwt', msg: 'invalid JWT' }, 401);
        if (method === 'PUT') {
          if (body?.data) account.user_metadata = { ...account.user_metadata, ...body.data };
          if (body?.password) account.password = body.password;
          save();
        }
        return json(userFor(account));
      }
      if (route === 'logout') return new Response(null, { status: 204 });
      if (route === 'recover') return json({});
      return json({ msg: `Demo auth route not implemented: ${route}` }, 404);
    }

    if(path.startsWith('/rest/v1/rpc/studio_')){
      const name=path.split('/').pop(), all=table('bookings');
      if(name==='studio_acknowledge_booking')return ['admin','superadmin'].includes(roleOf(currentAccount(headers)))?json(iso(0)):json({message:'Admin sign-in required'},403);
      if(name==='studio_schedule_settings'){Object.assign(table('studio_settings')[0],body.p_data);save();return json(table('studio_settings')[0]);}
      if(name==='studio_calendar')return json(all.filter(b=>b.booking_date>=body.p_from&&b.booking_date<=body.p_to&&b.status!=='cancelled'));
      if(name==='studio_team_directory')return json(table('users').filter(u=>u.role!=='customer'));
      if(name==='studio_can_verify_payment')return json(roleOf(currentAccount(headers))!=='staff');
      if(name==='studio_public_schedule')return json(table('studio_settings')[0]);
      if(name==='studio_booking_page'||name==='studio_export_bookings'){
        const f=body?.p_filters||{};let rows=all.filter(b=>(!f.q||JSON.stringify(b).toLowerCase().includes(f.q.toLowerCase()))&&(!f.status||f.status==='all'||b.status===f.status)&&(!f.customer||b.user_id===f.customer)&&(!f.from||b.booking_date>=f.from)&&(!f.to||b.booking_date<=f.to));
        if(f.view==='payments')rows=rows.filter(b=>b.payment_state==='under_review');if(f.view==='mine')rows=rows.filter(b=>b.assigned_to===currentAccount(headers)?.id||b.editor_id===currentAccount(headers)?.id);
        return json(name==='studio_export_bookings'?rows:{rows:rows.slice((body?.p_page||0)*(body?.p_size||25),((body?.p_page||0)+1)*(body?.p_size||25)),total:rows.length});
      }
      if(name==='studio_overview')return json({pending:2,today:0,unreviewed:2,requests:0,overdue:1,unassigned:2,late_reviews:1,email_issues:0,queue:all.filter(b=>b.status!=='cancelled')});
      if(name==='studio_clients')return json({total:2,rows:table('users').filter(u=>u.role==='customer').map(u=>({...u,user_id:u.id,bookings:3,last_shoot:day(6)}))});
      if(name==='studio_finance_report')return json({bookings:6,cancelled:1,booked_value:24350,deposits:12500,final_payments:0,refunds:0,outstanding:11850,repeat_clients:2,avg_review_hours:4,by_service:[{service:'Portrait Photography',bookings:2,booked_value:10000}],monthly:[{month:day(0).slice(0,7),bookings:6}]});
      if(name==='studio_email_history'||name==='studio_sessions')return json([]);
      if(name==='studio_update_booking'||name==='studio_save_preparation'){
        const b=all.find(b=>b.id===(body.p_id||body.p_booking));if(!b)return json({message:'Booking missing'},404);if(b.version!==body.p_version)return json({message:'This booking changed while you were editing.'},400);Object.assign(b,body.p_changes||{preparation:body.p_details});b.version++;save();return json(b);
      }
      if(name==='studio_add_note'){const n={id:uuid(),booking_id:body.p_booking,body:body.p_body,internal:body.p_internal,author_name:'Demo team',created_at:iso(0)};table('booking_notes').push(n);save();return json(n);}
      if(name==='studio_mark_read'){table('studio_notifications').forEach(n=>n.read_at=iso(0));save();return json(null);}
      return json({message:'This action is available on the connected studio; the local preview does not change real records.'},400);
    }
    // ---------------- RPC ----------------
    if (path === '/rest/v1/rpc/get_booked_slots') {
      const start = body?.start_date || '0000-01-01';
      const end = body?.end_date || '9999-12-31';
      return json(
        table('bookings')
          .filter((row) => ['pending', 'confirmed'].includes(row.status) && row.booking_date >= start && row.booking_date <= end)
          .map((row) => ({ booking_date: row.booking_date, start_time: row.start_time, end_time: row.end_time, status: row.status }))
      );
    }

    if (path === '/rest/v1/rpc/get_blocked_dates') {
      const start = body?.start_date || '0000-01-01';
      const end = body?.end_date || '9999-12-31';
      return json(
        table('blocked_dates')
          .filter((row) => row.blocked_date >= start && row.blocked_date <= end)
          .map((row) => ({ blocked_date: row.blocked_date }))
      );
    }

    // ---------------- PostgREST ----------------
    if (path.startsWith('/rest/v1/')) {
      const name = path.replace('/rest/v1/', '');
      const rows = table(name);
      const filters: [string, string][] = [];
      url.searchParams.forEach((value, key) => {
        if (!RESERVED.has(key)) filters.push([key, value]);
      });
      const selected = () => rows.filter((row) => filters.every(([column, expression]) => matches(row, column, expression)));
      const wantsObject = (headers.get('Accept') || '').includes('vnd.pgrst.object');
      const prefer = headers.get('Prefer') || '';
      const respond = (data: Row[], status = 200) => {
        if (wantsObject) {
          if (data.length !== 1) return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${data.length} rows` }, 406);
          return json(data[0], status);
        }
        return json(data, status);
      };

      if (method === 'GET' || method === 'HEAD') {
        let data = selected();
        const order = url.searchParams.get('order');
        if (order) {
          const parts = order.split(',').map((part) => part.split('.'));
          data = [...data].sort((a, b) => {
            for (const [column, direction] of parts) {
              const left = a[column] ?? '';
              const right = b[column] ?? '';
              if (left < right) return direction === 'desc' ? 1 : -1;
              if (left > right) return direction === 'desc' ? -1 : 1;
            }
            return 0;
          });
        }
        const limit = Number(url.searchParams.get('limit') || 0);
        if (limit) data = data.slice(0, limit);
        return respond(data);
      }

      if (method === 'POST') {
        const incoming = (Array.isArray(body) ? body : [body]) as Row[];
        const conflict = url.searchParams.get('on_conflict')?.split(',');
        const now = new Date().toISOString();
        const inserted: Row[] = [];
        for (const item of incoming) {
          if (conflict && prefer.includes('merge-duplicates')) {
            const existing = rows.find((row) => conflict.every((column) => String(row[column]) === String(item[column])));
            if (existing) {
              Object.assign(existing, item);
              inserted.push(existing);
              continue;
            }
          }
          const row = { id: uuid(), created_at: now, updated_at: now, ...item };
          rows.push(row);
          inserted.push(row);
        }
        save();
        return prefer.includes('return=representation') ? respond(inserted, 201) : new Response(null, { status: 201 });
      }

      if (method === 'PATCH') {
        const data = selected();
        data.forEach((row) => Object.assign(row, body));
        save();
        return prefer.includes('return=representation') ? respond(data) : new Response(null, { status: 204 });
      }

      if (method === 'DELETE') {
        const data = selected();
        db.tables[name] = rows.filter((row) => !data.includes(row));
        save();
        return prefer.includes('return=representation') ? respond(data) : new Response(null, { status: 204 });
      }
    }

    // ---------------- Storage: pretend buckets are missing so the inline fallback is exercised ----------------
    if (path.startsWith('/storage/v1/')) {
      return json({ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found (demo mode)' }, 400);
    }

    // ---------------- Edge function ----------------
    if (path.startsWith('/functions/v1/make-server-032fda65')) {
      const route = path.replace('/functions/v1/make-server-032fda65', '');
      const caller = currentAccount(headers);
      const callerRole = roleOf(caller);
      const isSuper = callerRole === 'superadmin';

      if (route === '/users' && method === 'POST') {
        if (!isSuper) return json({ error: 'Only superadmins can create users' }, 403);
        if (db.accounts.some((entry) => entry.email === body.email)) return json({ error: 'A user with this email already exists' }, 400);
        const account: DemoAccount = { id: uuid(), email: body.email, password: body.password, user_metadata: { full_name: body.fullName }, created_at: new Date().toISOString() };
        db.accounts.push(account);
        const row = { id: account.id, email: body.email, full_name: body.fullName, username: body.username || null, role: body.role || 'customer', status: body.status || 'active', created_at: account.created_at, updated_at: account.created_at };
        table('users').push(row);
        save();
        return json({ success: true, user: row });
      }
      const userMatch = route.match(/^\/users\/([^/]+)$/);
      if (userMatch && userMatch[1] !== 'profile') {
        if (!isSuper) return json({ error: 'Only superadmins can manage users' }, 403);
        const target = table('users').find((row) => row.id === userMatch[1]);
        if (!target) return json({ error: 'User not found' }, 404);
        if (method === 'PUT') {
          if (body.fullName) target.full_name = body.fullName;
          if (body.role) target.role = body.role;
          if (body.status) target.status = body.status;
          if (body.username !== undefined) target.username = body.username;
          target.updated_at = new Date().toISOString();
          save();
          return json({ success: true, user: target });
        }
        if (method === 'DELETE') {
          db.tables.users = table('users').filter((row) => row.id !== target.id);
          db.accounts = db.accounts.filter((entry) => entry.id !== target.id);
          save();
          return json({ success: true });
        }
      }
      const bookingMatch = route.match(/^\/bookings\/([^/]+)$/);
      if (bookingMatch && method === 'DELETE') {
        if (!callerRole || callerRole === 'customer') return json({ error: 'Forbidden' }, 403);
        db.tables.bookings = table('bookings').filter((row) => row.id !== bookingMatch[1]);
        save();
        return json({ success: true });
      }
      // Email notifications and anything else: accept silently.
      return json({ success: true, demo: true });
    }

    return json({ message: `Demo mode: no handler for ${method} ${path}` }, 404);
  };
}
