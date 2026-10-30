import { useEffect, useState } from "react";
import { api } from "./api";
import { Overview, Revenue, Guests, Operations, Reports, PeriodBar, ExportBtn, periods } from "./Insights.jsx";

const kes = n => "KES " + Number(n || 0).toLocaleString("en-KE");
const addDays = (d, k) => new Date(Date.parse(d) + k * 864e5).toISOString().slice(0, 10);
const COLORS = ["#B8441F", "#D9A066", "#9A4A2B", "#E9B79A", "#6A584C"];
const STATUS = { confirmed: "Confirmed", payment_submitted: "Verify payment", awaiting_payment: "Awaiting payment", cancelled: "Cancelled" };

function Login({ onDone }) {
  const [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const go = async e => { e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api("/admin/login", { method: "POST", body: { password: pw } }); localStorage.setItem("ew_token", r.token); onDone(); }
    catch (x) { setErr(x.message); } setBusy(false); };
  return <form className="login" onSubmit={go}><h2 style={{ color: "var(--green)" }}>Ewalel admin</h2>
    <label>Password<input type="password" value={pw} onChange={e => setPw(e.target.value)} autoFocus /></label>
    <p role="alert" style={{ color: "var(--red)" }}>{err}</p><button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form>;
}

function Bookings({ d, act, range }) {
  const [nb, setNb] = useState({ unitId: d.units[0].id, checkIn: "", checkOut: "", guests: 2, name: "", phone: "", total: "" });
  const patch = (b, body, ok) => act(() => api(`/admin/bookings/${b.id}`, { method: "PATCH", auth: true, body }), ok);
  const unit = id => d.units.find(u => u.id === id)?.name;
  const rows = [...d.bookings].sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
  const date = (b, k) => <input key={b.id + b[k]} type="date" defaultValue={b[k]} onBlur={e => e.target.value && e.target.value !== b[k] && patch(b, { [k]: e.target.value }, "Dates updated")} />;
  return <>
    <h2>Add a booking</h2>
    <div className="panel row">
      <label>Penthouse<select value={nb.unitId} onChange={e => setNb({ ...nb, unitId: e.target.value })}>{d.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label>Check in<input type="date" value={nb.checkIn} onChange={e => setNb({ ...nb, checkIn: e.target.value })} /></label>
      <label>Check out<input type="date" value={nb.checkOut} onChange={e => setNb({ ...nb, checkOut: e.target.value })} /></label>
      <label>Guest name<input value={nb.name} onChange={e => setNb({ ...nb, name: e.target.value })} /></label>
      <label>Phone<input value={nb.phone} onChange={e => setNb({ ...nb, phone: e.target.value })} /></label>
      <label>Total (blank = price x nights)<input type="number" value={nb.total} onChange={e => setNb({ ...nb, total: e.target.value })} /></label>
      <button className="btn" onClick={() => act(() => api("/admin/bookings", { method: "POST", auth: true, body: nb }), "Booking added")}>Add booking</button>
    </div>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h2>All bookings</h2><ExportBtn kind="bookings" label="Export bookings to Excel" range={range} /></div>
    <div className="panel tw"><table><thead><tr><th>Guest</th><th>Penthouse</th><th>Check in</th><th>Check out</th><th>Status</th><th>Total</th><th>M-Pesa receipt</th><th /></tr></thead><tbody>
      {rows.map(b => <tr key={b.id}>
        <td><b>{b.name}</b><br /><small>{b.ref} · {b.phone}</small></td><td>{unit(b.unitId)}</td><td>{date(b, "checkIn")}</td><td>{date(b, "checkOut")}</td>
        <td><select value={b.status} onChange={e => patch(b, { status: e.target.value }, "Status updated")}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {b.status === "awaiting_payment" && !b.live && <><br /><small>hold expired</small></>}</td>
        <td>{kes(b.total)}<br /><small>deposit {kes(b.deposit)}</small></td>
        <td>{b.receipt || "-"}{b.status === "payment_submitted" && <><br /><button className="sm go" onClick={() => patch(b, { status: "confirmed" }, "Payment verified")}>Mark paid</button></>}</td>
        <td><button className="sm del" onClick={() => confirm(`Delete booking ${b.ref}?`) && act(() => api(`/admin/bookings/${b.id}`, { method: "DELETE", auth: true }), "Deleted")}>Delete</button></td>
      </tr>)}
      {!rows.length && <tr><td colSpan="8">No bookings yet.</td></tr>}
    </tbody></table></div>
    <h2>M-Pesa payments received</h2>
    <div className="panel tw"><table><thead><tr><th>Receipt</th><th>Amount</th><th>From</th><th>Account</th><th>Matched booking</th></tr></thead><tbody>
      {d.mpesa.map(p => <tr key={p.transId}><td>{p.transId}</td><td>{kes(p.amount)}</td><td>{p.name || p.msisdn}</td><td>{p.account}</td><td>{d.bookings.find(b => b.receipt === p.transId)?.ref || "-"}</td></tr>)}
      {!d.mpesa.length && <tr><td colSpan="5">Nothing yet. In manual mode, you verify receipts yourself with "Mark paid".</td></tr>}
    </tbody></table></div>
  </>;
}

function Maintenance({ d, act }) {
  const [m, setM] = useState({ unitId: d.units[0].id, from: "", to: "", reason: "" });
  const add = async () => { const r = await act(() => api("/admin/blocks", { method: "POST", auth: true, body: m }), "Maintenance added");
    if (r?.clashes?.length) alert("Warning: these dates overlap existing booking(s): " + r.clashes.join(", ")); };
  return <>
    <h2>Mark maintenance</h2>
    <p className="hint">Maintenance days are blocked on the guest website. Leave "Last day" empty for a single day.</p>
    <div className="panel row">
      <label>Penthouse<select value={m.unitId} onChange={e => setM({ ...m, unitId: e.target.value })}>{d.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label>First day<input type="date" value={m.from} onChange={e => setM({ ...m, from: e.target.value })} /></label>
      <label>Last day<input type="date" min={m.from} value={m.to} onChange={e => setM({ ...m, to: e.target.value })} /></label>
      <label>Reason<input value={m.reason} onChange={e => setM({ ...m, reason: e.target.value })} placeholder="Plumbing, painting…" /></label>
      <button className="btn" onClick={add}>Block these days</button>
    </div>
    <div className="panel tw" style={{ marginTop: 14 }}><table><thead><tr><th>Penthouse</th><th>From</th><th>To</th><th>Reason</th><th /></tr></thead><tbody>
      {[...d.blocks].sort((a, b) => (a.from < b.from ? -1 : 1)).map(x => <tr key={x.id}><td>{d.units.find(u => u.id === x.unitId)?.name}</td><td>{x.from}</td><td>{x.to}</td><td>{x.reason}</td>
        <td><button className="sm del" onClick={() => act(() => api(`/admin/blocks/${x.id}`, { method: "DELETE", auth: true }), "Maintenance removed")}>Remove</button></td></tr>)}
      {!d.blocks.length && <tr><td colSpan="5">No maintenance planned.</td></tr>}
    </tbody></table></div>
  </>;
}

function Prices({ d, act }) {
  const [p, setP] = useState(Object.fromEntries(d.units.map(u => [u.id, { price: u.price, cap: u.cap }])));
  const [s, setS] = useState({ depositPercent: d.settings.depositPercent, till: d.settings.till });
  return <>
    <h2>Nightly prices</h2>
    <div className="cards">{d.units.map(u => <div className="panel" key={u.id}><h3>{u.name}</h3>
      <label>Price per night (KES)<input type="number" min="0" value={p[u.id].price} onChange={e => setP({ ...p, [u.id]: { ...p[u.id], price: e.target.value } })} /></label>
      <label>Sleeps (guests)<input type="number" min="1" value={p[u.id].cap} onChange={e => setP({ ...p, [u.id]: { ...p[u.id], cap: e.target.value } })} /></label>
      <p><button className="btn" onClick={() => act(() => api(`/admin/units/${u.id}`, { method: "PATCH", auth: true, body: p[u.id] }), "Price saved")}>Save {u.name}</button></p></div>)}</div>
    <h2>Payment settings</h2>
    <div className="panel row">
      <label>Deposit (% of the stay)<input type="number" min="0" max="100" value={s.depositPercent} onChange={e => setS({ ...s, depositPercent: e.target.value })} /></label>
      <label>M-Pesa Till or Paybill number<input value={s.till} onChange={e => setS({ ...s, till: e.target.value })} /></label>
      <button className="btn" onClick={() => act(() => api("/admin/settings", { method: "PATCH", auth: true, body: s }), "Settings saved")}>Save</button>
    </div>
    <p className="hint">New prices apply to new bookings straight away. Existing bookings keep the price they were made at.</p>
  </>;
}

function Photos({ d, act }) {
  const up = (u, file) => { if (!file) return; const f = new FormData(); f.append("image", file); act(() => api(`/admin/units/${u.id}/images`, { method: "POST", auth: true, form: f }), "Photo added"); };
  return <>{d.units.map(u => <div key={u.id}><h2>{u.name}</h2>
    <div className="panel"><div className="thumbs">{u.images.map((url, i) => <figure key={url}><img src={url} alt="" />
      <figcaption>{i === 0 ? <span className="tag confirmed">Cover</span> : <button className="sm" onClick={() => act(() => api(`/admin/units/${u.id}/cover`, { method: "POST", auth: true, body: { url } }), "Cover changed")}>Make cover</button>}
        <button className="sm del" onClick={() => confirm("Delete this photo?") && act(() => api(`/admin/units/${u.id}/images?url=${encodeURIComponent(url)}`, { method: "DELETE", auth: true }), "Photo deleted")}>Delete</button></figcaption></figure>)}</div>
      <label>Add a photo (JPG, PNG or WebP, up to 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { up(u, e.target.files[0]); e.target.value = ""; }} /></label></div></div>)}</>;
}

const TABS = [["overview", "Overview"], ["revenue", "Revenue"], ["guests", "Guests"], ["operations", "Operations"], ["bookings", "Bookings"], ["maintenance", "Maintenance"], ["prices", "Prices"], ["photos", "Photos"], ["reports", "Excel reports"]];

export default function Admin() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("ew_token")), [d, setD] = useState(null), [tab, setTab] = useState("overview"), [msg, setMsg] = useState(""), [period, setPeriod] = useState("year");
  const out = () => { localStorage.removeItem("ew_token"); setAuthed(false); setD(null); };
  const load = () => api("/admin/data", { auth: true }).then(setD).catch(e => (e.status === 401 ? out() : setMsg(e.message)));
  useEffect(() => { authed && load(); }, [authed]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(""), 3500); return () => clearTimeout(t); } }, [msg]);
  const act = async (fn, ok = "Saved") => { try { const r = await fn(); await load(); setMsg(ok); return r; } catch (e) { if (e.status === 401) out(); else setMsg(e.message); } };
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  if (!d) return <p style={{ padding: 40 }}>Loading…</p>;
  const opts = periods(d.today), range = { from: opts[period][1], to: opts[period][2] };
  const View = { overview: Overview, revenue: Revenue, guests: Guests, operations: Operations, bookings: Bookings, maintenance: Maintenance, prices: Prices, photos: Photos, reports: Reports }[tab];
  return <div className="adm">
    <header><div className="wrap"><b style={{ fontFamily: "Fraunces,serif", fontSize: 20 }}>Ewalel admin</b>
      <nav>{TABS.map(([k, l]) => <button key={k} aria-current={tab === k} onClick={() => setTab(k)}>{l}</button>)}</nav>
      <button className="sm" onClick={out}>Sign out</button></div></header>
    <main>{["overview", "revenue", "guests", "operations", "bookings", "reports"].includes(tab) && <PeriodBar opts={opts} period={period} setPeriod={setPeriod} />}<View key={tab} d={d} act={act} range={range} opts={opts} period={period} go={setTab} /></main>
    {msg && <div className="toast" role="status">{msg}</div>}
  </div>;
}
