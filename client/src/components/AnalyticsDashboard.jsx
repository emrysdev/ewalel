import React, { useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Wallet, Hourglass, Users, House, TrendingUp, CalendarPlus, Wrench, FileBarChart, ArrowRight, CreditCard, ChevronDown } from "lucide-react";

const money = n => `KES ${Number(n || 0).toLocaleString("en-KE", {maximumFractionDigits:0})}`;
const number = n => Number(n || 0);
const parseDate = x => { if (!x) return null; const d = new Date(x); return Number.isFinite(d.getTime()) ? d : null; };
const day = x => {const d=parseDate(x);return d?d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"—"};
const key = d => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : "";
const monthKey = d => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` : "";
const amount = b => number(b.total ?? b.total_amount ?? b.amount);
const name = b => b.guest_name || b.name || "Guest";
const bookingDate = b => parseDate(b.created_at || b.createdAt);
const paymentDate = p => parseDate(p.completed_at || p.paid_at || p.received_at || p.created_at);
const method = p => String(p.method || p.payment_method || "").toLowerCase();
const isPaid = p => ["completed", "paid", "verified", "success", "successful"].includes(String(p.status || "").toLowerCase());
const dateWithin = (d, start, end) => d && d >= start && d < end;
function Range({range,setRange}) {return <label className="ea-range"><CalendarDays size={18}/><select value={range} onChange={e=>setRange(e.target.value)} aria-label="Analytics period"><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="180">Last 6 months</option><option value="365">Last 12 months</option><option value="all">All available dates</option></select><ChevronDown size={15}/></label>}
function LineChart({values,labels,mode}) {
 const w=780,h=220,top=20,bottom=182,left=24,right=760,max=Math.max(1,...values);
 const pts=values.map((v,i)=>[left+(right-left)*(values.length===1?0.5:i/(values.length-1)),bottom-v/max*(bottom-top)]);
 const line=pts.map(([x,y],i)=>`${i?'L':'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
 const area=`${line} L ${pts.at(-1)?.[0]||right} ${bottom} L ${pts[0]?.[0]||left} ${bottom} Z`;
 return <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${mode} trend chart`} preserveAspectRatio="none"><defs><linearGradient id="ea-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#73d9c2" stopOpacity=".48"/><stop offset="1" stopColor="#73d9c2" stopOpacity=".03"/></linearGradient></defs>{[0,.25,.5,.75,1].map(v=><g key={v}><line x1={left} x2={right} y1={bottom-(bottom-top)*v} y2={bottom-(bottom-top)*v} stroke="#e9efec" strokeWidth="1"/><text x="1" y={bottom-(bottom-top)*v+4} fill="#81928d" fontSize="10">{Math.round(max*v)}</text></g>)}<path d={area} fill="url(#ea-fill)"/><path d={line} fill="none" stroke="#08745f" strokeWidth="3" strokeLinejoin="round"/>{pts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3.5" fill="#08745f" stroke="white" strokeWidth="1.5"/>)}{labels.map((l,i)=><text key={i} x={left+(right-left)*(labels.length===1?.5:i/(labels.length-1))} y="210" fontSize="11" textAnchor="middle" fill="#6c8079">{l}</text>)}</svg>;
}
export default function AnalyticsDashboard({bookings=[],payments=[],cottages=[],finance={},onNavigate,onRefresh}) {
 const [range,setRange]=useState("30"); const [chart,setChart]=useState("Revenue");
 const analytics=useMemo(()=>{
  const now=new Date(),end=new Date(now);end.setHours(23,59,59,999);end.setMilliseconds(end.getMilliseconds()+1);
  const days=range==='all'?null:Number(range);
  const allDates=[...bookings.map(bookingDate),...payments.map(paymentDate)].filter(Boolean);
  const start=days?new Date(now.getFullYear(),now.getMonth(),now.getDate()-days+1):new Date(Math.min(...allDates.map(d=>d.getTime()),now.getTime()));
  const bs=bookings.filter(b=>dateWithin(bookingDate(b),start,end));
  const ps=payments.filter(p=>isPaid(p)&&dateWithin(paymentDate(p),start,end));
  const paymentTotal=ps.reduce((s,p)=>s+number(p.amount),0);
  const collected=number(finance.revenue); const outstanding=number(finance.outstanding);
  const byMethod=(finance.methods||[]).map(m=>({method:String(m.method||'').toLowerCase(),amount:number(m.amount)}));
  const paymentRows=['mpesa','cash','card'].map(m=>({method:m,amount:byMethod.find(x=>x.method===m)?.amount ?? payments.filter(p=>isPaid(p)&&method(p)===m).reduce((s,p)=>s+number(p.amount),0)}));
  const totalMethod=paymentRows.reduce((s,m)=>s+m.amount,0);
  const buckets=[];let cursor=new Date(start.getFullYear(),start.getMonth(),1);const stop=new Date(now.getFullYear(),now.getMonth(),1);
  while(cursor<=stop && buckets.length<36){buckets.push(new Date(cursor));cursor.setMonth(cursor.getMonth()+1)}
  const trend=buckets.map(d=>({label:d.toLocaleDateString('en-GB',{month:'short',year:buckets.length>12?'2-digit':undefined}), bookings:bs.filter(b=>monthKey(bookingDate(b))===monthKey(d)).length, revenue:ps.filter(p=>monthKey(paymentDate(p))===monthKey(d)).reduce((s,p)=>s+number(p.amount),0)}));
  const uniqueGuests=new Set(bs.map(b=>String(b.guest_id||b.guest_email||b.email||b.guest_phone||b.phone||b.guest_name||b.name||'').trim().toLowerCase()).filter(Boolean));
  const guestCount=uniqueGuests.size;
  const cottageStats=cottages.map(c=>{const id=String(c.id),title=c.name||c.cottage_name||`Cottage #${id}`;const count=bs.filter(b=>String(b.cottage_id||b.unit_id)===id || (!b.cottage_id&&String(b.cottage_name||'')===title)).length;return {id,title,count};}).sort((a,b)=>b.count-a.count);
  const recent=[...bs].sort((a,b)=>(bookingDate(b)?.getTime()||0)-(bookingDate(a)?.getTime()||0)).slice(0,5);
  return {bs,ps,collected,outstanding,paymentTotal,paymentRows,totalMethod,trend,guestCount,cottageStats,recent};
 },[bookings,payments,cottages,finance,range]);
 const colors={mpesa:'#075c4b',cash:'#71c879',card:'#b2e8dc'};
 const {bs,ps,collected,outstanding,paymentTotal,paymentRows,totalMethod,trend,guestCount,cottageStats,recent}=analytics;
 const donut=totalMethod?`conic-gradient(${paymentRows.map((p,i)=>{const prev=paymentRows.slice(0,i).reduce((s,x)=>s+x.amount,0)/totalMethod*100;return `${colors[p.method]} ${prev}% ${prev+p.amount/totalMethod*100}%`}).join(',')})`:'#e6efec';
 const goto=(t,s)=>onNavigate?.(t,s);
 return <div className="ea-dashboard">
  <div className="ea-heading"><div><p className="ea-crumb">Administration / Overview / Dashboard</p><h1>Dashboard</h1><p>A live overview of bookings, revenue and cottage performance.</p></div><div className="ea-head-actions"><Range range={range} setRange={setRange}/><button className="ea-refresh" onClick={onRefresh} title="Refresh MySQL data"><RefreshCw size={18}/></button></div></div>
  <div className="ea-kpis">
   {[{title:'Total Revenue',value:money(collected),note:'All-time verified revenue',icon:Wallet,tone:'green'},{title:'Outstanding Payments',value:money(outstanding),note:'All-time outstanding',icon:Hourglass,tone:'peach'},{title:'Total Bookings',value:bs.length,note:'Bookings created in period',icon:CalendarDays,tone:'blue'},{title:'Unique Guests',value:guestCount,note:'Identified in selected bookings',icon:Users,tone:'purple'},{title:'Active Cottages',value:cottages.length,note:'From cottage records',icon:House,tone:'mint'}].map(x=><article className={`ea-kpi ea-${x.tone}`} key={x.title}><div className="ea-kpi-top"><span className="ea-icon"><x.icon size={22}/></span><span>{x.title}</span></div><strong>{x.value}</strong><small>{x.note}</small></article>)}
  </div>
  <div className="ea-top-grid"><section className="ea-panel"><div className="ea-panel-head"><div><h2>Business Trends</h2><small>Recorded by month · selected period</small></div><div className="ea-tabs">{['Revenue','Bookings'].map(x=><button key={x} className={chart===x?'selected':''} onClick={()=>setChart(x)}>{x}</button>)}</div></div><div className="ea-chart"><LineChart values={trend.map(x=>chart==='Revenue'?x.revenue:x.bookings)} labels={trend.map(x=>x.label)} mode={chart}/></div><p className="ea-footnote">Revenue trend uses dated verified payments. Finance totals above are all-time values supplied by the backend.</p></section>
  <section className="ea-panel"><div className="ea-panel-head"><h2>Revenue by Payment Method</h2></div><div className="ea-donut-layout"><div className="ea-donut" style={{background:donut}}><div><small>Total collected</small><strong>{money(totalMethod)}</strong><small>By method</small></div></div><div className="ea-methods">{paymentRows.map(p=><div className="ea-method" key={p.method}><i style={{background:colors[p.method]}}/><span>{p.method==='mpesa'?'M-PESA':p.method==='cash'?'Cash':'Card'}</span><b>{totalMethod?(p.amount/totalMethod*100).toFixed(1):'0.0'}%</b><strong>{money(p.amount)}</strong></div>)}</div></div><p className="ea-footnote">All-time totals from the finance report.</p></section></div>
  <div className="ea-mid-grid"><section className="ea-panel"><div className="ea-panel-head"><h2>Cottage Booking Performance</h2><small>Bookings created in period</small></div>{cottageStats.length?cottageStats.slice(0,6).map(c=><div className="ea-property" key={c.id}><span title={c.title}>{c.title}</span><div className="ea-progress"><div style={{width:`${c.count/Math.max(1,...cottageStats.map(x=>x.count))*100}%`}}/></div><b>{c.count}</b></div>):<p className="ea-empty">No cottages available.</p>}<p className="ea-footnote">Booking counts are shown instead of occupancy percentages because room-night availability is not supplied by the existing dashboard API.</p></section>
  <section className="ea-panel"><div className="ea-panel-head"><h2>Bookings by Month</h2><small>{bs.length} in period</small></div><div className="ea-bars">{trend.slice(-8).map((x,i)=><div className="ea-bar-col" key={i}><b>{x.bookings||''}</b><div className="ea-bar" style={{height:`${Math.max(3,x.bookings/Math.max(1,...trend.map(t=>t.bookings))*140)}px`}}/><span>{x.label}</span></div>)}</div></section>
  <section className="ea-panel"><div className="ea-panel-head"><h2>Key Insights</h2></div><div className="ea-insight"><TrendingUp size={19}/><div><b>{bs.length} new bookings</b><p>Created during the selected period</p></div></div><div className="ea-insight"><CreditCard size={19}/><div><b>{money(outstanding)} outstanding</b><p>Follow up on unpaid balances</p></div></div><div className="ea-insight"><Users size={19}/><div><b>{guestCount} identifiable guests</b><p>Based on available booking details</p></div></div></section></div>
  <div className="ea-bottom-grid"><section className="ea-panel"><div className="ea-panel-head"><h2>Recent Bookings</h2><button className="ea-link" onClick={()=>goto('Reservations','Bookings')}>View all <ArrowRight size={15}/></button></div><div className="ea-table-wrap"><table className="ea-table"><thead><tr><th>Booking ID</th><th>Guest</th><th>Cottage</th><th>Check-in</th><th>Check-out</th><th>Amount</th><th>Status</th></tr></thead><tbody>{recent.map(b=><tr key={b.id}><td>#{b.ref||b.id}</td><td>{name(b)}</td><td>{b.cottage_name||b.unit_id||'—'}</td><td>{day(b.check_in)}</td><td>{day(b.check_out)}</td><td>{money(amount(b))}</td><td><span className={`ea-status ea-status-${String(b.status||'').replace(/[^a-z]/gi,'')}`}>{String(b.status||'unknown').replaceAll('_',' ')}</span></td></tr>)}</tbody></table>{!recent.length&&<p className="ea-empty">No bookings in this period.</p>}</div></section><section className="ea-panel"><div className="ea-panel-head"><h2>Quick Actions</h2></div><div className="ea-actions">{[{label:'Bookings',icon:CalendarPlus,t:'Reservations',s:'Bookings'},{label:'Manage Cottages',icon:House,t:'Cottages',s:'Manage cottages'},{label:'Maintenance',icon:Wrench,t:'Maintenance',s:'Maintenance'},{label:'Finance',icon:FileBarChart,t:'Finance',s:'Revenue & payments'}].map(a=><button key={a.label} onClick={()=>goto(a.t,a.s)}><a.icon size={27}/><span>{a.label}</span></button>)}</div></section></div>
 </div>;
}
