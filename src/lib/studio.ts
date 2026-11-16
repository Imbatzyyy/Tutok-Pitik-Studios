import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isDemoMode } from './supabase';
export async function rpc<T=any>(name:string,args:Record<string,unknown>={}) :Promise<T>{const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.message);return data as T;}
export const money=(n:unknown)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(n)||0);
export const label=(s:unknown)=>String(s||'').replaceAll('_',' ');
export type LiveState='Preview'|'Connecting'|'Live'|'Reconnecting'|'Offline';
/** Private refresh signals contain no customer data. Every refresh rechecks RLS. */
export function useStudioLive(userId:string,team:boolean,onRefresh:()=>void,enabled=true){
 const fn=useRef(onRefresh);fn.current=onRefresh;const [state,setState]=useState<LiveState>(isDemoMode?'Preview':navigator.onLine?'Connecting':'Offline');
 useEffect(()=>{if(!enabled||isDemoMode)return;let disposed=false;let debounce:number;let channel:ReturnType<typeof supabase.channel>;
 const refresh=()=>{clearTimeout(debounce);debounce=window.setTimeout(()=>{if(!disposed)fn.current();},250);};
 const connect=async()=>{const {data:{session}}=await supabase.auth.getSession();if(disposed||!session)return;await supabase.realtime.setAuth(session.access_token);if(disposed)return;
 channel=supabase.channel(team?'studio:team':`studio:user:${userId}`,{config:{private:true}}).on('broadcast',{event:'changed'},refresh).subscribe(status=>{
 if(disposed)return;setState(status==='SUBSCRIBED'?'Live':navigator.onLine?'Reconnecting':'Offline');if(status==='SUBSCRIBED')refresh();});};
 void connect();const online=()=>{setState('Reconnecting');refresh();};const offline=()=>setState('Offline');const visible=()=>{if(!document.hidden&&navigator.onLine)refresh();};
 window.addEventListener('online',online);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',visible);
 const timer=window.setInterval(visible,60_000);const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(session)void supabase.realtime.setAuth(session.access_token);});
 return()=>{disposed=true;clearTimeout(debounce);clearInterval(timer);subscription.unsubscribe();if(channel)void supabase.removeChannel(channel);window.removeEventListener('online',online);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',visible);};
 },[userId,team,enabled]);return state;
}
const unsavedForms=new Set<symbol>();
export const hasUnsavedChanges=()=>unsavedForms.size>0;
export const confirmNavigation=()=>!hasUnsavedChanges()||window.confirm('Discard your unsaved changes?');
export function useUnsaved(dirty:boolean){useEffect(()=>{if(!dirty)return;const key=Symbol();unsavedForms.add(key);const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>{unsavedForms.delete(key);window.removeEventListener('beforeunload',guard);};},[dirty]);}
export function useResource<T>(load:()=>Promise<T>,deps:unknown[]=[]){const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);const run=useRef(0);const refresh=useCallback(async()=>{const n=++run.current;try{const value=await load();if(n===run.current){setData(value);setError('');}}catch(e){if(n===run.current)setError(e instanceof Error?e.message:'Could not load data');}finally{if(n===run.current)setLoading(false);}},deps);useEffect(()=>{setLoading(true);void refresh();return()=>{run.current++;};},[refresh]);return {data,error,loading,refresh};}
export function download(name:string,content:string,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function csv(rows:unknown[][]){return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
export function calendarFile(b:any){const esc=(s:unknown)=>String(s??'').replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;');const stamp=(d:string,t:string)=>new Date(`${d}T${t.slice(0,8)}+08:00`).toISOString().replace(/[-:]/g,'').replace('.000','');download(`TPS-${b.id.slice(0,6)}.ics`,['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Tutok Pitik Studios//Booking//EN','BEGIN:VEVENT',`UID:${b.id}@tutokpitikstudios.com`,`DTSTAMP:${stamp(b.booking_date,b.start_time)}`,`DTSTART:${stamp(b.booking_date,b.start_time)}`,`DTEND:${stamp(b.booking_date,b.end_time)}`,`SUMMARY:${esc(b.service)} · Tutok Pitik Studios`,`LOCATION:${esc(b.location)}`,`DESCRIPTION:${esc('Booking '+b.id+' · '+label(b.status))}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n'),'text/calendar');}
export async function uploadPrivate(bucket:string,user:string,file:File){if(file.size>10*1024*1024)throw new Error('Choose a file under 10 MB.');if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw new Error('Use JPG, PNG, WebP or PDF.');const ext=file.type==='application/pdf'?'pdf':file.type.split('/')[1];const path=`${user}/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});if(error)throw new Error('Upload failed. Keep this page open and retry.');return path;}
export async function openPrivate(bucket:string,path:string){const {data,error}=await supabase.storage.from(bucket).createSignedUrl(path,60);if(error||!data?.signedUrl)throw new Error('This file is unavailable or you do not have access.');window.open(data.signedUrl,'_blank','noopener,noreferrer');}
