import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, download } from "./api";

const kes = n => "KES " + Number(n || 0).toLocaleString("en-KE");
const addDays = (d, k) => new Date(Date.parse(d) + k * 864e5).toISOString().slice(0, 10);
const ml = k => new Date(k + "-01T00:00:00Z").toLocaleString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
const dm = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const COLORS = ["#B8441F", "#D9A066", "#9A4A2B", "#E9B79A", "#6A584C"];

export const periods = t => {
  const [y, m] = t.slice(0, 7).split("-").map(Number), ms = (a, b) => new Date(Date.UTC(a, b - 1, 1)).toISOString().slice(0, 10), me = (a, b) => new Date(Date.UTC(a, b, 0)).toISOString().slice(0, 10);
  return { thisMonth: ["This month", ms(y, m), me(y, m)], next90: ["Next 90 days", t, addDays(t, 89)], last3: ["Last 3 months", ms(y, m - 2), me(y, m)], year: ["This year", y + "-01-01", y + "-12-31"], last12: ["Last 12 months", ms(y, m - 11), me(y, m)] };
};
export function PeriodBar({ opts, period, setPeriod }) {
  return <div className="period" role="group" aria-label="Period">{Object.entries(opts).map(([k, [l]]) => <button key={k} aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
    <small>{opts[period][1]} to {opts[period][2]}</small></div>;
}
export function ExportBtn({ kind, label, range, primary }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const go = async () => { setBusy(true); setErr(""); try { await download(`/admin/export/${kind}?from=${range.from}&to=${range.to}`, `ewalel-${kind}-${new Date().toISOString().slice(0, 10)}.xlsx`); } catch (e) { setErr(e.message); } setBusy(false); };
  return <span><button className={primary ? "btn" : "sm go"} onClick={go} disabled={busy}>{busy ? "Preparing…" : label}</button>{err && <small style={{ color: "var(--red)" }}> {err}</small>}</span>;
}
function useA(d, range) {
  const [A, setA] = useState(null), [err, setErr] = useState("");
  useEffect(() => { let on = true; api(`/admin/analytics?from=${range.from}&to=${range.to}`, { auth: true }).then(x => on && (setA(x), setErr(""))).catch(e => on && setErr(e.message)); return () => { on = false; }; }, [d, range.from, range.to]);
  return [A, err];
}
const Kpi = ({ l, v, s }) => <div className="kpi"><small>{l}</small><b>{v}</b>{s && <em>{s}</em>}</div>;
const Mini = ({ title, data, k = "value", n = "label", color = COLORS[0] }) => <div className="panel"><h3>{title}</h3><ResponsiveContainer width="100%" height={190}><BarChart data={data}><XAxis dataKey={n} fontSize={12} /><YAxis allowDecimals={false} width={30} /><Tooltip /><Bar dataKey={k} fill={color} /></BarChart></ResponsiveContainer></div>;
const Wait = ({ err }) => <p style={{ padding: 20 }}>{err || "Loading…"}</p>;

function Timeline({ d, days = 90 }) {
  const t = d.today, ds = Array.from({ length: days }, (_, i) => addDays(t, i)), live = d.bookings.filter(b => b.live);
  const cell = (u, day) => {
    if (d.blocks.some(x => x.unitId === u.id && day >= x.from && day <= x.to)) return "mt";
    const b = live.find(x => x.unitId === u.id && day >= x.checkIn && day < x.checkOut);
    return b ? (b.status === "confirmed" ? "bk" : "pn") : "fr";
  };
  return <><div className="tl" style={{ gridTemplateColumns: `90px repeat(${days}, minmax(11px,1fr))` }}>
    <span />{ds.map(x => <span key={x} style={{ fontSize: 10 }}>{x.slice(8) === "01" ? dm(x).split(" ")[1] : x === t ? "▾" : ""}</span>)}
    {d.units.map(u => [<b key={u.id}>{u.name.replace("Penthouse ", "")}</b>, ...ds.map(x => <span key={u.id + x} className={"c " + cell(u, x)} title={`${u.name}, ${dm(x)}`} />)])}</div>
    <div className="key"><span><i className="c bk" />Confirmed</span><span><i className="c pn" />Awaiting or verifying payment</span><span><i className="c mt" />Maintenance</span><span><i className="c fr" />Free</span></div></>;
}
const Stays = ({ rows, empty, out }) => <div className="tw"><table><thead><tr><th>Guest</th><th>Penthouse</th><th>{out ? "Check out" : "Check in"}</th><th>Guests</th><th>Phone</th></tr></thead><tbody>
  {rows.map(b => <tr key={b.ref + (out ? "o" : "i")}><td><b>{b.name}</b><br /><small>{b.ref}</small></td><td>{b.unit}</td><td>{dm(out ? b.checkOut : b.checkIn)}</td><td>{b.guests}</td><td>{b.phone}</td></tr>)}
  {!rows.length && <tr><td colSpan="5">{empty}</td></tr>}</tbody></table></div>;

export function Overview({ d, range, go }) {
  const [A, err] = useA(d, range); if (!A) return <Wait err={err} />;
  const T = A.totals, F = A.funnel, P = A.pipeline, att = [];
  if (P.submitted.count) att.push(<li key="s"><b>{P.submitted.count}</b> M-Pesa payment{P.submitted.count > 1 ? "s" : ""} to verify <button className="sm go" onClick={() => go("bookings")}>Open bookings</button></li>);
  if (P.expiringSoon) att.push(<li key="e"><b>{P.expiringSoon}</b> unpaid hold{P.expiringSoon > 1 ? "s" : ""} expire within 6 hours</li>);
  const today = A.ops.arrivals.filter(b => b.checkIn === A.today);
  if (today.length) att.push(<li key="a"><b>{today.length}</b> arrival{today.length > 1 ? "s" : ""} today: {today.map(b => `${b.name} (${b.unit})`).join(", ")}</li>);
  att.push(<li key="h">{A.ops.inHouse.length ? <><b>{A.ops.inHouse.length}</b> stay{A.ops.inHouse.length > 1 ? "s" : ""} in progress now</> : "No guests in the cottages right now"}</li>);
  const data = A.months.map(m => ({ label: ml(m.month), ...Object.fromEntries(d.units.map(u => [u.name, m.byUnit[u.id].revenue])), "Occupancy %": m.occupancy }));
  const fun = [{ n: "Requests", v: F.requests }, { n: "Receipt sent", v: F.submitted + F.confirmed }, { n: "Confirmed", v: F.confirmed }, { n: "Expired unpaid", v: F.expired }];
  return <>
    <div className="panel att"><h3>Needs your attention</h3><ul>{att}</ul></div>
    <div className="kpis" style={{ marginTop: 14 }}>
      <Kpi l="Revenue" v={kes(T.revenue)} s="confirmed stays in period" /><Kpi l="Occupancy" v={T.occupancy + "%"} s={`${T.nights} of ${T.available} nights`} /><Kpi l="Average daily rate" v={kes(T.adr)} /><Kpi l="Revenue per available night" v={kes(T.revpar)} />
      <Kpi l="Bookings" v={T.bookings} s={`${T.guests} guests`} /><Kpi l="Average stay" v={T.avgStay + " nights"} /><Kpi l="Booking conversion" v={F.conversion + "%"} s={F.avgHoursToConfirm ? `confirmed in ${F.avgHoursToConfirm} h on average` : "website requests paid"} /><Kpi l="Balance due on arrival" v={kes(P.balanceDue)} s={`${P.upcoming.count} upcoming stays`} />
    </div>
    <div className="grid2">
      <div className="panel"><h3>Revenue and occupancy by month</h3><ResponsiveContainer width="100%" height={260}><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" /><XAxis dataKey="label" /><YAxis yAxisId="l" tickFormatter={v => v / 1000 + "k"} /><YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" /><Tooltip /><Legend />
        {d.units.map((u, i) => <Bar key={u.id} yAxisId="l" dataKey={u.name} stackId="a" fill={COLORS[i]} />)}<Line yAxisId="r" dataKey="Occupancy %" stroke="#241A15" strokeWidth={2} /></ComposedChart></ResponsiveContainer></div>
      <div className="panel"><h3>Website booking funnel</h3><ResponsiveContainer width="100%" height={260}><BarChart data={fun} layout="vertical"><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="n" width={100} /><Tooltip /><Bar dataKey="v">{fun.map((_, i) => <Cell key={i} fill={[COLORS[1], COLORS[3], COLORS[0], COLORS[4]][i]} />)}</Bar></BarChart></ResponsiveContainer></div>
    </div>
    <div className="panel" style={{ marginTop: 14 }}><h3>Next 60 days</h3><Timeline d={d} days={60} /></div>
  </>;
}

export function Revenue({ d, range }) {
  const [A, err] = useA(d, range); if (!A) return <Wait err={err} />;
  const T = A.totals, P = A.pipeline, line = A.months.map(m => ({ label: ml(m.month), "Average daily rate": m.adr, "Revenue per available night": m.revpar }));
  return <>
    <div className="kpis"><Kpi l="Revenue" v={kes(T.revenue)} /><Kpi l="Average daily rate" v={kes(T.adr)} s="revenue per night sold" /><Kpi l="Revenue per available night" v={kes(T.revpar)} /><Kpi l="Average booking value" v={kes(T.avgValue)} />
      <Kpi l="Upcoming confirmed" v={kes(P.upcoming.value)} s={`${P.upcoming.count} stays`} /><Kpi l="Awaiting payment" v={kes(P.awaiting.value)} s={`${P.awaiting.count} holds, deposits ${kes(P.awaiting.deposits)}`} /></div>
    <div className="grid2">
      <div className="panel"><h3>Average daily rate and revenue per available night</h3><ResponsiveContainer width="100%" height={240}><LineChart data={line}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" /><XAxis dataKey="label" /><YAxis tickFormatter={v => v / 1000 + "k"} /><Tooltip formatter={v => kes(v)} /><Legend /><Line dataKey="Average daily rate" stroke={COLORS[0]} strokeWidth={2} /><Line dataKey="Revenue per available night" stroke={COLORS[2]} strokeWidth={2} /></LineChart></ResponsiveContainer></div>
      <div className="panel"><h3>Revenue by penthouse</h3><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={A.byUnit} dataKey="revenue" nameKey="name" outerRadius={80} label={x => x.name.replace("Penthouse ", "")}>{A.byUnit.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip formatter={v => kes(v)} /></PieChart></ResponsiveContainer></div>
      <Mini title="Booked how far ahead" data={A.leadTime} /><Mini title="Length of stay" data={A.stayLength} color={COLORS[2]} /><Mini title="Check-in day of the week" data={A.weekday} color={COLORS[1]} />
      <Mini title="Bookings by source" data={A.source} k="bookings" color={COLORS[3]} />
    </div>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h2>Month by month</h2><ExportBtn kind="revenue" label="Export to Excel" range={range} /></div>
    <div className="panel tw"><table><thead><tr><th>Month</th><th>Revenue</th><th>Nights sold</th><th>Occupancy</th><th>Avg daily rate</th><th>Per available night</th></tr></thead><tbody>
      {A.months.map(m => <tr key={m.month}><td>{ml(m.month)}</td><td>{kes(m.revenue)}</td><td>{m.nights}</td><td>{m.occupancy}%</td><td>{kes(m.adr)}</td><td>{kes(m.revpar)}</td></tr>)}</tbody></table></div>
  </>;
}

export function Guests({ d, range }) {
  const [A, err] = useA(d, range), [q, setQ] = useState(""), [seg, setSeg] = useState("");
  if (!A) return <Wait err={err} />;
  const C = A.clientSummary, rows = A.clients.filter(c => (!seg || c.segment === seg) && (c.name + c.phone + c.email).toLowerCase().includes(q.toLowerCase())).slice(0, 300);
  return <>
    <div className="kpis"><Kpi l="Guests who have stayed" v={C.total} /><Kpi l="Returning guests" v={C.returning} s={C.repeatRate + "% repeat rate"} /><Kpi l="Average spend per guest" v={kes(C.avgSpend)} /><Kpi l="Average stays per guest" v={C.avgStays} /></div>
    <div className="grid2">
      <div className="panel"><h3>New and returning guests by month</h3><ResponsiveContainer width="100%" height={240}><BarChart data={C.newVsReturning.map(x => ({ label: ml(x.month), "First-time": x.new, Returning: x.returning }))}><XAxis dataKey="label" /><YAxis allowDecimals={false} width={30} /><Tooltip /><Legend /><Bar dataKey="First-time" stackId="a" fill={COLORS[1]} /><Bar dataKey="Returning" stackId="a" fill={COLORS[0]} /></BarChart></ResponsiveContainer></div>
      <div className="panel"><h3>Top guests by spend</h3><ResponsiveContainer width="100%" height={240}><BarChart data={C.top.map(c => ({ name: c.name, spent: c.spent }))} layout="vertical"><XAxis type="number" tickFormatter={v => v / 1000 + "k"} /><YAxis type="category" dataKey="name" width={110} /><Tooltip formatter={v => kes(v)} /><Bar dataKey="spent" fill={COLORS[2]} /></BarChart></ResponsiveContainer></div>
    </div>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h2>Client list</h2><ExportBtn kind="clients" label="Export clients to Excel" range={range} primary /></div>
    <div className="panel row"><label>Search<input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, phone or email" /></label>
      <label>Segment<select value={seg} onChange={e => setSeg(e.target.value)}><option value="">All</option><option>Returning</option><option>First-time</option><option>Enquiry only</option></select></label><small>{rows.length} shown</small></div>
    <div className="panel tw" style={{ marginTop: 14 }}><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Segment</th><th>Stays</th><th>Nights</th><th>Spent</th><th>Last stay</th><th>Next stay</th><th>Favourite</th></tr></thead><tbody>
      {rows.map(c => <tr key={c.key}><td><b>{c.name}</b></td><td>{c.phone}</td><td>{c.email || "-"}</td><td><span className="tag">{c.segment}</span></td><td>{c.stays}</td><td>{c.nights}</td><td>{kes(c.spent)}</td><td>{c.last ? dm(c.last) : "-"}</td><td>{c.next ? dm(c.next) : "-"}</td><td>{c.favourite || "-"}</td></tr>)}
      {!rows.length && <tr><td colSpan="10">No guests match.</td></tr>}</tbody></table></div>
  </>;
}

export function Operations({ d, range }) {
  const [A, err] = useA(d, range); if (!A) return <Wait err={err} />;
  return <>
    <div className="panel"><h3>Next 90 days</h3><Timeline d={d} days={90} /></div>
    <div className="grid2">{A.byUnit.map(u => <div className="panel" key={u.id}><h3>{u.name}: occupancy in period</h3><div className="prog"><i style={{ width: u.occupancy + "%" }} /></div><p>{u.occupancy}% ({u.nights} of {u.available} nights) · {kes(u.revenue)}</p></div>)}</div>
    <h2>In the cottages now</h2><div className="panel"><Stays rows={A.ops.inHouse} empty="Nobody is staying right now." out /></div>
    <h2>Arrivals, next 14 days</h2><div className="panel"><Stays rows={A.ops.arrivals} empty="No arrivals." /></div>
    <h2>Departures, next 14 days</h2><div className="panel"><Stays rows={A.ops.departures} empty="No departures." out /></div>
    <h2>Maintenance ahead</h2><div className="panel tw"><table><thead><tr><th>Penthouse</th><th>From</th><th>To</th><th>Days</th><th>Reason</th></tr></thead><tbody>
      {A.ops.maintenance.map(x => <tr key={x.id}><td>{x.unit}</td><td>{dm(x.from)}</td><td>{dm(x.to)}</td><td>{x.days}</td><td>{x.reason}</td></tr>)}{!A.ops.maintenance.length && <tr><td colSpan="5">None planned.</td></tr>}</tbody></table></div>
  </>;
}

export function Reports({ range, opts, period }) {
  const items = [["report", "Full business report", "One workbook with every sheet below, ready to share with an accountant or partner.", true], ["clients", "Client list", "Every guest: contact details, stays, nights, total spent, first, last and next stay, favourite penthouse."],
    ["bookings", "Bookings", "Every booking in the period with dates, status, totals, deposits, balances and M-Pesa receipts."], ["payments", "M-Pesa payments", "Each receipt, the deposit due, the amount received and how it was verified."],
    ["revenue", "Revenue and occupancy", "Month by month: revenue per penthouse, nights sold, occupancy, average daily rate."], ["maintenance", "Maintenance log", "All maintenance days per penthouse with reasons."]];
  return <>
    <p className="hint">Period for bookings, revenue and the summary: <b>{opts[period][0]}</b> ({range.from} to {range.to}). Change it with the buttons above. Client list, payments and maintenance always include everything.</p>
    <div className="exp">{items.map(([k, t, desc, p]) => <div className="panel" key={k}><h3>{t}</h3><p>{desc}</p><ExportBtn kind={k} label="Download Excel (.xlsx)" range={range} primary={p} /></div>)}</div>
    <p className="hint" style={{ marginTop: 18 }}>These files contain guests' personal details. Store them securely and share them only with people who need them.</p>
  </>;
}
