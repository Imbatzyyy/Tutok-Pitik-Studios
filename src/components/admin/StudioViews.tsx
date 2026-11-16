import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CheckCheck, Clock3, Inbox, LoaderCircle, Mail, RefreshCw, Search, Users, Wallet } from 'lucide-react';
import { paymentLabel, paymentTone, type NormalizedBooking } from '../../lib/bookings';
import { formatDateShort, formatPeso } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { includesText } from './shared';
import type { LoadState } from './AdminDashboard';

export function PaymentsView({bookings,onOpen,state}:{bookings:NormalizedBooking[];onOpen:(id:string)=>void;state:LoadState}) {
  const [filter,setFilter]=useState('all');const [query,setQuery]=useState('');
  const live=bookings.filter(b=>b.status!=='cancelled');
  const shown=bookings.filter(b=>(filter==='all'||b.paymentStatus===filter)&&includesText([b.fullName,b.reference,b.paymentReference],query));
  if(state==='loading')return <p className="loading-row"><LoaderCircle className="spin"/> Loading payments…</p>;
  return <section className="admin-section"><header className="admin-head"><div><p className="studio-eyebrow">MONEY & RECEIPTS</p><h1>Payments</h1><p>Review GCash proof, verify downpayments and track shoot-day balances.</p></div></header>
    <div className="kpi-grid studio-kpi-three"><div className="kpi"><span className="kpi-label"><Clock3 size={18}/> To verify</span><strong className="kpi-value">{live.filter(b=>b.paymentStatus==='submitted').length}</strong><span className="kpi-hint">Active bookings with submitted payment</span></div><div className="kpi"><span className="kpi-label"><CheckCheck size={18}/> Verified downpayments</span><strong className="kpi-value">{formatPeso(live.filter(b=>b.paymentStatus==='verified').reduce((s,b)=>s+b.downpaymentAmount,0))}</strong><span className="kpi-hint">Recorded as verified · excludes cancellations</span></div><div className="kpi"><span className="kpi-label"><Wallet size={18}/> Scheduled balances</span><strong className="kpi-value">{formatPeso(live.filter(b=>b.status==='confirmed').reduce((s,b)=>s+b.remainingBalance,0))}</strong><span className="kpi-hint">Confirmed bookings · not a collected-cash total</span></div></div>
    <div className="admin-toolbar"><label className="studio-search"><Search size={18}/><input aria-label="Search payments" placeholder="Client, booking or payment reference" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Payment status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All payment statuses</option><option value="submitted">Needs verification</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></div>
    {state==='error'&&<p className="notice notice-danger">Payments could not be refreshed. Use Refresh data above.</p>}
    <div className="admin-card studio-table-wrap"><table className="admin-table"><thead><tr><th>Client / booking</th><th>GCash reference</th><th>Downpayment</th><th>Balance</th><th>Status</th><th/></tr></thead><tbody>{shown.map(b=><tr key={b.id}><td><strong>{b.fullName}</strong><small>{b.reference} · {formatDateShort(b.date)}</small></td><td data-label="GCash reference">{b.paymentReference||'Not provided'}</td><td data-label="Downpayment">{formatPeso(b.downpaymentAmount)}</td><td data-label="Balance">{formatPeso(b.remainingBalance)}</td><td data-label="Status"><span className={`badge badge-${paymentTone(b.paymentStatus)}`}>{paymentLabel(b.paymentStatus)}</span>{b.status==='cancelled'&&<small>Booking cancelled</small>}</td><td><button className="btn btn-ghost btn-sm" onClick={()=>onOpen(b.id)}>Review <ArrowUpRight size={15}/></button></td></tr>)}</tbody></table>{!shown.length&&<div className="studio-empty"><Wallet/><h3>No payments to show</h3><p>Payment submissions will appear with their booking.</p></div>}</div>
  </section>;
}

export function CustomersView({bookings,onOpen,state}:{bookings:NormalizedBooking[];onOpen:(id:string)=>void;state:LoadState}) {
  const [query,setQuery]=useState('');
  const customers=useMemo(()=>{
    const map=new Map<string,{name:string;email:string;phone:string;bookings:NormalizedBooking[]}>();
    for(const b of bookings){const key=b.userId||b.email;const current=map.get(key)||{name:b.fullName,email:b.email,phone:b.phone,bookings:[]};current.bookings.push(b);map.set(key,current);}
    return [...map.values()].filter(c=>includesText([c.name,c.email,c.phone],query)).sort((a,b)=>a.name.localeCompare(b.name));
  },[bookings,query]);
  if(state==='loading')return <p className="loading-row">Loading clients…</p>;
  if(state==='error')return <p className="notice notice-danger">Client history could not be loaded. Use Refresh data to try again.</p>;
  return <section className="admin-section"><header className="admin-head"><div><p className="studio-eyebrow">THE PEOPLE BEHIND THE MOMENTS</p><h1>Clients</h1><p>Contact details and booking history for clients who have reserved a session.</p></div><span className="badge badge-neutral">{customers.length} clients</span></header><label className="studio-search"><Search size={18}/><input aria-label="Search clients" placeholder="Search by name, email or phone" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="studio-client-grid">{customers.map(c=><article className="admin-card studio-client" key={c.email}><span className="studio-client-initial">{c.name.slice(0,1)}</span><h2>{c.name}</h2><a href={`mailto:${c.email}`}>{c.email}</a><p>{c.phone||'No phone provided'}</p><footer><span>{c.bookings.length} {c.bookings.length===1?'booking':'bookings'}</span><button className="btn btn-ghost btn-sm" onClick={()=>onOpen(c.bookings[0].id)}>Latest booking <ArrowUpRight size={14}/></button></footer></article>)}</div>{!customers.length&&<div className="studio-empty"><Users/><h3>No matching clients</h3><p>Try a different search, or wait for the first reservation.</p></div>}
  </section>;
}

type Activity={id:number;occurred_at:string;actor_role:string;resource:string;record_id:string;action:string;status_before:string|null;status_after:string|null};
const resourceNames:Record<string,string>={bookings:'Booking',users:'Account',portfolio_images:'Portfolio image',testimonials:'Testimonial',blocked_dates:'Availability'};
export function ActivityView({onOpen}:{onOpen:(id:string)=>void}) {
  const [rows,setRows]=useState<Activity[]>([]);const [state,setState]=useState<LoadState>('loading');
  const load=useCallback(async()=>{setState('loading');const {data,error}=await supabase.from('studio_activity').select('id,occurred_at,actor_role,resource,record_id,action,status_before,status_after').order('occurred_at',{ascending:false}).limit(100);if(error){setState('error');return;}setRows(data||[]);setState('ready');},[]);
  useEffect(()=>{void load();},[load]);
  return <section className="admin-section"><header className="admin-head"><div><p className="studio-eyebrow">WHAT’S HAPPENING</p><h1>Activity</h1><p>The latest 100 recorded changes, starting from this workspace’s launch.</p></div><button className="btn btn-ghost btn-sm" onClick={()=>void load()}><RefreshCw size={16}/> Refresh activity</button></header><div className="admin-card">{state==='loading'?<p className="loading-row"><LoaderCircle className="spin"/> Loading activity…</p>:state==='error'?<p className="notice notice-danger">Activity couldn’t be loaded. Please try again.</p>:rows.length?<ol className="studio-timeline">{rows.map(r=><li key={r.id}><span className="studio-timeline-dot"/><div><strong>{resourceNames[r.resource]||'Studio record'} {r.action==='insert'?'created':r.action==='delete'?'removed':'updated'}</strong><p>{r.status_after&&r.status_before!==r.status_after?`${r.status_before||'New'} → ${r.status_after}`:`${r.actor_role==='system'?'System / server operation':r.actor_role.replace('_',' ')} · ${r.record_id.slice(0,8)}`}</p><time>{new Date(r.occurred_at).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})}</time></div>{r.resource==='bookings'&&r.action!=='delete'&&<button className="btn btn-ghost btn-sm" onClick={()=>onOpen(r.record_id)}>View booking</button>}</li>)}</ol>:<div className="studio-empty"><Clock3/><h3>A fresh start</h3><p>New booking and studio changes will be recorded here. Earlier activity is not backfilled.</p></div>}</div></section>;
}

export function InboxView(){
 const [rows,setRows]=useState<any[]>([]);const [state,setState]=useState<LoadState>('loading');
 const load=useCallback(async()=>{const {data,error}=await supabase.from('contact_messages').select('id,name,email,message,created_at').order('created_at',{ascending:false}).limit(100);setState(error?'error':'ready');if(!error)setRows(data||[]);},[]);
 useEffect(()=>{void load();},[load]);
 return <section className="admin-section"><header className="admin-head"><div><p className="studio-eyebrow">CONVERSATIONS</p><h1>Inquiries</h1><p>Latest website inquiries. Replies open in your email app.</p></div><button className="btn btn-ghost btn-sm" onClick={()=>void load()}><RefreshCw size={16}/> Refresh inquiries</button></header>{state==='error'?<div className="notice notice-danger">Inquiries couldn’t be loaded.</div>:state==='loading'?<p className="loading-row">Loading inquiries…</p>:rows.length?<div className="studio-client-grid">{rows.map(r=><article className="admin-card studio-client" key={r.id}><h2>{r.name||'Website visitor'}</h2><small>{new Date(r.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</small><p className="studio-message">{r.message}</p><a className="btn btn-ghost" href={`mailto:${r.email}`}><Mail size={16}/> Reply by email</a></article>)}</div>:<div className="admin-card studio-empty"><Inbox/><h3>All caught up</h3><p>Website inquiry records will appear here. Messenger and Gmail conversations stay in their own apps.</p></div>}</section>;
}
