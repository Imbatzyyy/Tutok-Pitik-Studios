import type { NormalizedBooking } from './bookings';
import { photoLabel, statusLabel } from './bookings';
import logoUrl from '../assets/logo-160.png';
import type { UserOptions } from 'jspdf-autotable';

const php=(value:unknown)=>`PHP ${Number(value||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const text=(value:unknown)=>String(value??'-').replace(/[–—‑]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/₱/g,'PHP ').replace(/×/g,'x').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
const date=(value:string|number|Date)=>new Date(value).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',day:'2-digit',month:'short',year:'numeric'});
const DARK:[number,number,number]=[35,44,37],ACCENT:[number,number,number]=[174,61,48],MUTED:[number,number,number]=[104,111,105];
let logoPromise:Promise<Uint8Array>|undefined;
const loadLogo=()=>logoPromise??(logoPromise=fetch(logoUrl).then(r=>{if(!r.ok)throw Error('Studio logo could not load');return r.arrayBuffer();}).then(b=>new Uint8Array(b)).catch(e=>{logoPromise=undefined;throw e;}));

/** Every export uses the same logo, typography, pagination and private-record footer. */
async function createDocument(title:string,subtitle:string,landscape=false){
 const [{default:jsPDF},{default:autoTable},logo]=await Promise.all([import('jspdf'),import('jspdf-autotable'),loadLogo()]);
 const doc=new jsPDF({orientation:landscape?'landscape':'portrait',compress:true});
 const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight(),margin=14,content=width-margin*2;
 doc.setProperties({title:`${title} | Tutok Pitik Studios`,author:'Tutok Pitik Studios',creator:'Tutok Pitik Studios',subject:'Private studio record'});
 let y=72;const generated=new Date();
 const ensure=(space:number)=>{if(y+space>height-25){doc.addPage();y=72;}};
 const cards=(items:[string,unknown][])=>{
  const columns=Math.min(items.length,3),gap=4,cardWidth=(content-gap*(columns-1))/columns;
  for(let i=0;i<items.length;i+=columns){ensure(26);items.slice(i,i+columns).forEach(([label,value],j)=>{const x=margin+j*(cardWidth+gap);doc.setFillColor(244,245,240);doc.roundedRect(x,y,cardWidth,20,2,2,'F');doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...MUTED);doc.text(text(label).toUpperCase(),x+5,y+7);doc.setFont('helvetica','bold');doc.setFontSize(14);const v=text(value);if(doc.getTextWidth(v)>cardWidth-10)doc.setFontSize(Math.max(8,14*(cardWidth-10)/doc.getTextWidth(v)));doc.setTextColor(...DARK);doc.text(v,x+5,y+15);});y+=26;}
 };
 const section=(heading:string,head:string[],rows:unknown[][],options:Partial<UserOptions>={})=>{
  ensure(29);doc.setFillColor(...ACCENT);doc.rect(margin,y,1.2,5,'F');doc.setTextColor(...DARK);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(text(heading),margin+4,y+4);
  autoTable(doc,{...options,startY:y+8,head:[head.map(text)],body:rows.length?rows.map(r=>r.map(text)):[head.map((_,i)=>i===0?'No records for this selection':'-')],margin:{top:72,bottom:25,left:margin,right:margin},theme:'plain',rowPageBreak:'avoid',showHead:'everyPage',styles:{font:'helvetica',fontSize:9,textColor:DARK,cellPadding:2,overflow:'linebreak',lineColor:[227,230,224],lineWidth:0.15,...options.styles},headStyles:{fillColor:DARK,textColor:[255,255,255],fontStyle:'bold',fontSize:8.5,...options.headStyles},alternateRowStyles:{fillColor:[247,248,244]},...options.columnStyles&&{columnStyles:options.columnStyles}});
  y=(doc as any).lastAutoTable.finalY+8;
 };
 const note=(value:string)=>{doc.setFont('helvetica','normal');doc.setFontSize(8.5);const lines=doc.splitTextToSize(text(value),content-10);ensure(lines.length*4+12);doc.setFillColor(247,248,244);doc.roundedRect(margin,y,content,lines.length*4+10,2,2,'F');doc.setTextColor(...MUTED);doc.text(lines,margin+5,y+6);y+=lines.length*4+16;};
 const finish=()=>{
  const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){
   doc.setPage(i);doc.setFillColor(...DARK);doc.rect(0,0,width,40,'F');doc.addImage(logo,'PNG',14,7,26,26,'studio-logo','FAST');
   doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(255);doc.text('TUTOK PITIK STUDIOS',47,16);
   doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(222,227,217);doc.text('tutokpitikstudios@gmail.com',47,24);doc.text('tutokpitikstudios.com',47,30);
   doc.setFontSize(7);doc.text('PRIVATE STUDIO RECORD',width-14,16,{align:'right'});doc.text(date(generated)+' | Manila',width-14,26,{align:'right'});
   doc.setFillColor(...ACCENT);doc.rect(14,46,9,1.1,'F');doc.setFont('helvetica','bold');doc.setTextColor(...DARK);doc.setFontSize(21);doc.text(title,14,58);
   doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...MUTED);doc.text(doc.splitTextToSize(text(subtitle),content),14,65);
   doc.setDrawColor(216,221,211);doc.line(14,height-18,width-14,height-18);doc.setFontSize(7.5);doc.text('Tutok Pitik Studios  |  Made for meaningful moments',14,height-12);doc.text(`Page ${i} of ${pages}`,width-14,height-12,{align:'right'});
  }return doc;
 };
 return {doc,cards,section,note,finish};
}

export async function buildBookingReceipt(booking:NormalizedBooking){
 const p=await createDocument('Booking receipt',`Reference ${booking.receiptNumber}  |  Issued ${date(booking.receiptIssuedAt||Date.now())}  |  Times in Manila`);
 const paid=Number(booking.raw.paid_amount??(booking.paymentStatus==='verified'?booking.downpaymentAmount:0)),refund=Number(booking.raw.refunded_amount||0);
 p.cards([['Session total',php(booking.totalAmount)],['Verified payments',php(paid)],['Outstanding',php(booking.remainingBalance)]]);
 p.section('Your photography session',['Detail','Information'],[['Client',`${booking.fullName}\n${booking.email||'-'}`],['Service',booking.service],['Schedule',`${booking.dateDisplay}\n${booking.time}`],['Location',booking.location||'-'],['Reservation',statusLabel(booking.status)],['Gallery progress',booking.photoStatus?photoLabel(booking.photoStatus):'-']],{columnStyles:{0:{cellWidth:42,fontStyle:'bold'}}});
 p.section('Payment summary',['Description','Amount'],[[`Photography (${booking.durationHours} hours x ${php(booking.serviceRate)})`,php(booking.baseSubtotal)],['Transportation',php(booking.transportationFee)],['Session total',php(booking.totalAmount)],['Verified payments received',php(paid)],['Recorded refunds',php(refund)],['Outstanding balance',php(booking.remainingBalance)]],{columnStyles:{1:{cellWidth:48,halign:'right'}}});
 if(booking.driveLink)p.section('Gallery delivery',['Access','Private gallery'],[['Gallery link',booking.driveLink]],{columnStyles:{0:{cellWidth:42}}});
 p.note('Booking and studio payment record. Only payments verified by the studio are shown as received. Keep this document and any gallery link private.');return p.finish();
}
export async function downloadBookingReceipt(booking:NormalizedBooking){(await buildBookingReceipt(booking)).save(`${booking.receiptNumber}.pdf`);}

export async function buildBookingsReport(bookings:NormalizedBooking[]){
 const p=await createDocument('Bookings report','Complete exported selection | Philippine time | Booking values are not proof of payment',true);
 p.cards([['Reservations',bookings.length],['Pending review',bookings.filter(b=>b.status==='pending').length],['Completed sessions',bookings.filter(b=>b.status==='completed').length]]);
 p.section('Reservation register',['Reference','Client / email','Service / venue','Schedule','Status','Total'],bookings.map(b=>[b.reference,`${b.fullName}\n${b.email}`,`${b.service}\n${b.location||'-'}`,`${b.date}\n${b.time}`,statusLabel(b.status),php(b.totalAmount)]),{columnStyles:{0:{cellWidth:35},1:{cellWidth:53},2:{cellWidth:68},3:{cellWidth:48},4:{cellWidth:31},5:{cellWidth:34,halign:'right'}},styles:{fontSize:8.5}});
 return p.finish();
}
export async function exportBookingsPdf(bookings:NormalizedBooking[]){(await buildBookingsReport(bookings)).save(`Tutok-Pitik-Bookings-${new Date().toISOString().slice(0,10)}.pdf`);}

export async function buildUsersReport(users:any[]){
 const p=await createDocument('Accounts report','Exported account directory | Contains private contact information',true);
 const isTeam=(u:any)=>['superadmin','super_admin','admin','staff'].includes(u.role);
 p.cards([['Accounts',users.length],['Studio team',users.filter(isTeam).length],['Customers',users.filter(u=>u.role==='customer').length]]);
 p.section('Account directory',['Name','Email','Username','Role','Status','Joined'],users.map(u=>[u.fullName||u.full_name||'-',u.email||'-',u.username||'-',String(u.role||'customer').replace('super_admin','superadmin'),u.status||'active',u.joinDate||u.created_at?date(u.joinDate||u.created_at):'-']),{columnStyles:{0:{cellWidth:53},1:{cellWidth:78},2:{cellWidth:40},3:{cellWidth:32},4:{cellWidth:29},5:{cellWidth:37}},styles:{fontSize:8.5}});
 p.note('For authorized studio administration only. Share this directory only with people who are permitted to access these accounts.');return p.finish();
}
export async function exportUsersPdf(users:any[]){(await buildUsersReport(users)).save(`Tutok-Pitik-Users-${new Date().toISOString().slice(0,10)}.pdf`);}

export async function buildOperationsReport(data:Record<string,any>,from:string,to:string,service:string){
 const p=await createDocument('Studio operations report',`Shoot dates ${from} to ${to} | Service: ${service||'All services'} | Currency: PHP`);
 p.cards([['Booked value',php(data.booked_value)],['Verified deposits',php(data.deposits)],['Outstanding',php(data.outstanding)]]);
 p.section('Financial overview',['Metric','Amount'],[['Booked value',php(data.booked_value)],['Verified deposits',php(data.deposits)],['Final payments',php(data.final_payments)],['Recorded refunds',php(data.refunds)],['Outstanding balance',php(data.outstanding)]],{columnStyles:{1:{cellWidth:62,halign:'right'}}});
 p.section('Booking performance',['Metric','Result'],[['Bookings',data.bookings],['Cancelled',data.cancelled],['Repeat clients in this period',data.repeat_clients],['Average payment review time',data.avg_review_hours==null?'Not enough data':`${Number(data.avg_review_hours).toFixed(1)} hours`]],{columnStyles:{1:{cellWidth:62,halign:'right'}}});
 p.section('Services',['Service','Bookings','Booked value'],(data.by_service||[]).map((s:any)=>[s.service,s.bookings,php(s.booked_value)]),{columnStyles:{1:{cellWidth:28,halign:'right'},2:{cellWidth:52,halign:'right'}}});
 p.section('Team workload',['Team member','Shoots','Editing','Overdue'],(data.workload||[]).map((w:any)=>[w.full_name,w.shoots,w.editing,w.overdue]),{columnStyles:{1:{cellWidth:27,halign:'right'},2:{cellWidth:27,halign:'right'},3:{cellWidth:27,halign:'right'}}});
 p.section('Monthly booking volume',['Month','Bookings'],(data.monthly||[]).map((m:any)=>[m.month,m.bookings]),{columnStyles:{1:{cellWidth:55,halign:'right'}}});
 p.note('Filtered by shoot date. Payments are studio-verified ledger records. This report is not a bank statement or a profit calculation. Repeat-client counts apply to the selected period.');return p.finish();
}
export async function exportReportPdf(data:Record<string,any>,from:string,to:string,service:string){(await buildOperationsReport(data,from,to,service)).save(`Tutok-Pitik-Report-${from}-${to}.pdf`);}
