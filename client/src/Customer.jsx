import { useEffect, useState } from "react";
import { api } from "./api";

const T = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);           // today in Nairobi
const kes = n => "KES " + Number(n).toLocaleString("en-KE");
const addDays = (d, k) => new Date(Date.parse(d) + k * 864e5).toISOString().slice(0, 10);
const nightsOf = (a, b) => (a && b && b > a ? Math.round((Date.parse(b) - Date.parse(a)) / 864e5) : 0);
const dstr = (d, y) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC", ...(y ? { year: "numeric" } : {}) });
const hit = (list, a, b) => list.some(([i, o]) => a < o && b > i);

// One month grid. Red = booked, hatched = maintenance. Tap check-in, then check-out.
function Cal({ av, s, setS, mo }) {
  const all = [...av.booked, ...av.maintenance], t = T();
  const isB = d => all.some(([i, o]) => d >= i && d < o), isM = d => av.maintenance.some(([i, o]) => d >= i && d < o);
  const [y, m] = mo.split("-").map(Number), lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => mo + "-" + String(i + 1).padStart(2, "0"))];
  const can = d => d >= t && (!isB(d) || (s.inn && !s.out && d > s.inn && !hit(all, s.inn, d)));
  const pick = d => setS(o => (!o.inn || o.out || d <= o.inn || hit(all, o.inn, d) ? { ...o, inn: d, out: "" } : { ...o, out: d }));
  const on = d => s.inn && ((!s.out && d === s.inn) || (s.out && d >= s.inn && d <= s.out));
  return (
    <div className="cal">
      <div className="dow">{"MTWTFSS".split("").map((x, i) => <span key={i}>{x}</span>)}</div>
      <div className="days">{cells.map((d, i) => d
        ? <button type="button" key={d} disabled={!can(d)} onClick={() => pick(d)} aria-label={d + (isM(d) ? ", unavailable" : isB(d) ? ", booked" : "")}
            className={"d" + (isM(d) ? " mt" : isB(d) ? " bk" : "") + (on(d) ? " in" : "") + (d < t ? " past" : "")}>{+d.slice(8)}</button>
        : <i key={"e" + i} />)}</div>
    </div>
  );
}

function BookedList({ av, onJump }) {
  const t = T(), yr = t.slice(0, 4);
  const L = av.booked.map(([i, o]) => [i, addDays(o, -1)]).filter(([, l]) => l >= t).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const lab = ([a, b]) => { const y = a.slice(0, 4) !== yr || b.slice(0, 4) !== yr;
    return a === b ? dstr(a, y) : a.slice(0, 7) === b.slice(0, 7) ? +a.slice(8) + "–" + dstr(b, y) : dstr(a, y) + " – " + dstr(b, y); };
  return (
    <div className="bl"><div className="bh">Upcoming booked days</div>
      {L.length ? L.map(r => <button type="button" key={r[0]} className="chip bk" onClick={() => onJump(r[0] < t ? t.slice(0, 7) : r[0].slice(0, 7))}>{lab(r)}</button>)
        : <span className="hint">No bookings yet. Every upcoming date is open.</span>}
    </div>
  );
}

// Booking pop-up: 1) details  2) pay by M-Pesa  3) confirm with the M-Pesa receipt number.
function Dialog({ data, start, s, onClose, onChange }) {
  const [uid, setUid] = useState(start.unit || data.units[0].id), [step, setStep] = useState(start.confirm ? "confirm" : "book");
  const [f, setF] = useState({ name: "", phone: "", email: "", notes: "", ref: "", receipt: "" });
  const [pay, setPay] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState("");
  const u = data.units.find(x => x.id === uid), n = nightsOf(s.inn, s.out), set = k => e => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, []);
  const run = async fn => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(e.message); } setBusy(false); };
  const book = () => run(async () => {
    const r = await api("/bookings", { method: "POST", body: { unitId: uid, checkIn: s.inn, checkOut: s.out, guests: s.guests, name: f.name, phone: f.phone, email: f.email, notes: f.notes } });
    setPay(r.pay); setF(x => ({ ...x, ref: r.booking.ref })); setStep("confirm"); onChange();
  });
  const confirm = () => run(async () => { const r = await api("/bookings/confirm", { method: "POST", body: { ref: f.ref, phone: f.phone, receipt: f.receipt } }); setDone(r.status); onChange(); });

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dlg" role="dialog" aria-modal="true">
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        {done ? <>
          <h2>{done === "confirmed" ? "Booking confirmed" : "Receipt received"}</h2>
          <p className="ok">{done === "confirmed" ? "Thank you! Your payment is confirmed and your dates are secured. We will message you on WhatsApp with arrival details."
            : "Thank you! We will check your M-Pesa payment and confirm on WhatsApp shortly. Your dates stay held for you."}</p>
          <p><button className="btn" onClick={onClose}>Done</button></p>
        </> : step === "book" ? <>
          <h2>Book your stay</h2>
          <div className="pills">{data.units.map(x => <button key={x.id} aria-pressed={uid === x.id} onClick={() => setUid(x.id)}>{x.name}</button>)}</div>
          <p className="sum" style={{ margin: "14px 0" }}>{n > 0 ? `${dstr(s.inn)} to ${dstr(s.out)}: ${n} ${n === 1 ? "night" : "nights"}, ${kes(n * u.price)}. Deposit now: ${kes(Math.ceil(n * u.price * data.settings.depositPercent / 100))}`
            : "Close this and tap your check-in and check-out days on the calendar."}</p>
          <form onSubmit={e => e.preventDefault()}>
            <label>Your name<input value={f.name} onChange={set("name")} autoComplete="name" /></label>
            <label>Phone (the M-Pesa number)<input type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" /></label>
            <label>Email (optional)<input type="email" value={f.email} onChange={set("email")} /></label>
            <label>Guests<input type="number" min="1" max={u.cap} value={s.guests} readOnly /></label>
            <label className="full">Notes (optional)<input value={f.notes} onChange={set("notes")} placeholder="Arrival time, celebrations" /></label>
            <p className="full" role="alert" style={{ color: "var(--red)", margin: 0 }}>{err}</p>
            <div className="actions full"><button type="button" className="btn" disabled={busy || n < 1} onClick={book}>{busy ? "Please wait…" : "Continue to payment"}</button></div>
          </form>
        </> : <>
          <h2>Confirm your booking</h2>
          {pay && <div className="pay">
            <p style={{ margin: "0 0 6px" }}>1. Pay the deposit by M-Pesa:</p>
            <b>{kes(pay.amount)}</b> to Till/Paybill <b>{pay.till}</b>, account <b>{pay.account}</b>.
            <p style={{ margin: "8px 0 0" }}>2. Enter the receipt number from the M-Pesa SMS below. Your dates are held for {pay.holdHours} hours.</p>
          </div>}
          <form onSubmit={e => e.preventDefault()}>
            <label>Booking code<input value={f.ref} onChange={set("ref")} placeholder="EW1A2B3C" /></label>
            <label>Phone used to book<input type="tel" value={f.phone} onChange={set("phone")} /></label>
            <label className="full">M-Pesa receipt number<input value={f.receipt} onChange={set("receipt")} placeholder="e.g. QGH7XYZ123" maxLength={12} style={{ textTransform: "uppercase" }} /></label>
            <p className="full" role="alert" style={{ color: "var(--red)", margin: 0 }}>{err}</p>
            <div className="actions full"><button type="button" className="btn" disabled={busy} onClick={confirm}>{busy ? "Checking…" : "Confirm booking"}</button></div>
          </form>
        </>}
      </div>
    </div>
  );
}

export default function Customer() {
  const [data, setData] = useState(null), [s, setS] = useState({ inn: "", out: "", guests: 2 });
  const [dlg, setDlg] = useState(null), [big, setBig] = useState(null), [mo, setMo] = useState(T().slice(0, 7));
  const load = () => api("/public").then(setData).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return <p className="wrap" style={{ padding: 40 }}>Loading…</p>;
  const { units, settings, availability } = data, n = nightsOf(s.inn, s.out), t = T();
  const set = k => e => { const v = e.target.value; setS(o => ({ ...o, [k]: v, ...(k === "inn" && o.out <= v ? { out: "" } : {}) })); };
  const shift = k => { const [y, m] = mo.split("-").map(Number); setMo(new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7)); };
  const label = new Date(mo + "-01T00:00:00Z").toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const photos = units.flatMap(u => u.images.map(url => ({ url, caption: u.name })));

  return <>
    <div className="shuka" />
    <div className="bar"><div className="wrap"><b>Ewalel Cottages</b><div className="r">
      <button className="btn alt" onClick={() => setDlg({ confirm: true })}>Confirm payment</button>
      <button className="btn" onClick={() => setDlg({ unit: units[0].id })}>Book now</button>
    </div></div></div>

    <header className="hero ph" style={{ backgroundImage: `linear-gradient(180deg,rgba(36,22,16,.2),rgba(36,22,16,.9)),url(${settings.hero})` }}>
      <div className="txt"><h1>Penthouse cottages above the flamingo lake.</h1>
        <p>Top-floor A-frame stays on the hill above Lake Elementaita, less than 1 km from the Nairobi–Nakuru highway. Karibu nyumbani.</p>
        <a className="btn" href="#stay">Choose your penthouse</a></div>
      <div className="shuka" />
    </header>

    <section style={{ paddingTop: 36 }}><div className="wrap"><h2>Take a look inside</h2><p className="hint">Swipe to browse. Tap a photo to enlarge it.</p>
      <div className="strip">{photos.map(p => <button key={p.url} className="shot" onClick={() => setBig(p.url)} aria-label={"Enlarge photo: " + p.caption}><img src={p.url} alt={p.caption} loading="lazy" /><span>{p.caption}</span></button>)}</div></div></section>

    <section id="stay" style={{ paddingTop: 24 }}><div className="wrap"><h2>Choose your penthouse</h2>
      <p className="hint">Tap your check-in and check-out days on the calendar. Red days are booked and hatched days are unavailable.</p>
      <div className="find">
        <label>Check in<input type="date" min={t} value={s.inn} onChange={set("inn")} /></label>
        <label>Check out<input type="date" min={s.inn || t} value={s.out} onChange={set("out")} /></label>
        <label>Guests<input type="number" min="1" max="8" value={s.guests} onChange={set("guests")} /></label>
      </div>
      <div className="mh"><button onClick={() => shift(-1)} disabled={mo <= t.slice(0, 7)} aria-label="Previous month">‹</button><span>{label}</span><button onClick={() => shift(1)} aria-label="Next month">›</button></div>
      <div className="cards">{units.map(u => {
        const av = availability[u.id], fits = +s.guests <= u.cap, free = !(n > 0 && hit([...av.booked, ...av.maintenance], s.inn, s.out));
        return (
          <article key={u.id} className={"card" + (fits ? "" : " off")}>
            {u.images[0] && <img className="art" src={u.images[0]} alt={u.name + " interior"} loading="lazy" />}
            <h3>{u.name}</h3><div className="sleeps">Sleeps {u.cap}, {u.beds}, lake-facing terrace</div><p>{u.blurb}</p>
            <div className="price">{kes(u.price)} <small>per night</small></div>
            <Cal av={av} s={s} setS={setS} mo={mo} />
            <div className="leg"><span><i style={{ background: "var(--red)" }} />Booked</span><span><i style={{ background: "#8a7a6e" }} />Unavailable</span><span><i style={{ background: "var(--green)" }} />Your dates</span></div>
            <BookedList av={av} onJump={setMo} />
            <div className="tot" role="status">{!fits ? `Too small for ${s.guests} guests` : !free ? "Not available for these dates" : n > 0 ? `${n} ${n === 1 ? "night" : "nights"}: ${kes(n * u.price)}` : " "}</div>
            <button className="btn" disabled={!fits || !free} onClick={() => setDlg({ unit: u.id })}>Book {u.name}</button>
          </article>
        );
      })}</div></div></section>

    {settings.murals?.length > 0 && <section className="mur"><div className="hills" dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 1200 80" preserveAspectRatio="none" width="100%" height="70" aria-hidden="true"><path style="fill:var(--hill)" d="M0 0H1200V44C1000 78 850 22 640 50S250 82 0 40Z"/><path fill="currentColor" d="M0 0H1200V22C980 58 820 6 600 30S220 60 0 20Z"/></svg>' }} />
      <div className="wrap"><h2>Walls that tell the story</h2><p className="lead">Hand-painted Kenyan murals of the savanna, the acacia and the dance greet you in every living room.</p>
        <div className="frames">{settings.murals.map(m => <figure key={m.url}><img src={m.url} alt={m.caption} loading="lazy" /><figcaption>{m.caption}</figcaption></figure>)}</div></div></section>}

    <footer><b>Ewalel Cottages</b><p>Lake Elementaita, Nakuru County, Kenya. Less than 1 km from the Nairobi–Nakuru highway.</p>
      {settings.whatsapp && <p><a href={"https://wa.me/" + settings.whatsapp}>WhatsApp +{settings.whatsapp}</a></p>}</footer>

    {big && <div className="ov" onClick={() => setBig(null)}><button className="x" style={{ position: "absolute", top: 14, right: 18, color: "#fff" }} aria-label="Close photo">×</button><img className="lb" src={big} alt="Enlarged photo" /></div>}
    {dlg && <Dialog data={data} start={dlg} s={s} onClose={() => setDlg(null)} onChange={load} />}
  </>;
}
