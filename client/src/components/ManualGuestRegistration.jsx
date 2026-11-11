import { useMemo, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:4000" : window.location.origin)).replace(/\/$/, "");
const todayKenya = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const initial = () => ({ name: "", phone: "", email: "", cottage_id: "", check_in: todayKenya(), check_out: "", guests: 1, additional_guests: [], payment_method: "cash", amount_received: "0", payment_reference: "", payment_verified: false, notes: "" });
const money = n => `KES ${Number(n || 0).toLocaleString("en-KE")}`;
const fieldStyle = { width: "100%", padding: "11px 12px", border: "1px solid #cbd9db", borderRadius: 9, color: "#17383e", background: "white", boxSizing: "border-box" };
const labelStyle = { display: "grid", gap: 6, fontSize: 13, fontWeight: 600 };

export default function ManualGuestRegistration({ cottages = [], token, onSaved = async () => {}, onError = () => {} }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState("");
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const selected = cottages.find(c => String(c.id) === String(form.cottage_id));
  const nights = form.check_in && form.check_out ? Math.round((Date.parse(`${form.check_out}T12:00:00Z`) - Date.parse(`${form.check_in}T12:00:00Z`)) / 86400000) : 0;
  const total = Math.max(0, nights) * Number(selected?.nightly_rate ?? selected?.price ?? 0);
  const amount = Number(form.amount_received || 0);
  const capacity = Number(selected?.capacity ?? selected?.cap ?? 50);
  const isCard = form.payment_method === "card";
  const isMpesa = form.payment_method === "mpesa";
  const isCash = form.payment_method === "cash";
  const valid = useMemo(() => !!selected && nights > 0 && Number.isInteger(Number(form.guests)) && Number(form.guests) >= 1 && Number(form.guests) <= capacity && form.name.trim().length > 0 && form.phone.trim().length > 0 && form.additional_guests.length === Math.max(0, Number(form.guests) - 1) && form.additional_guests.every(n => n.trim()) && Number.isFinite(amount) && amount >= 0 && amount <= total && (isCard || amount === 0 || (form.payment_verified && (!isMpesa || !!form.payment_reference.trim()))), [selected, nights, form, capacity, amount, total, isCard, isMpesa]);

  async function request(path, payload) {
    const response = await fetch(`${API_BASE}/api${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status})`);
    return data;
  }

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    if (!valid) return setMessage("Complete all required details, including every additional guest name and payment verification.");
    setBusy(true);
    try {
      const common = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), cottage_id: form.cottage_id, check_in: form.check_in, check_out: form.check_out, guests: Number(form.guests), additional_guests: form.additional_guests.map(n => n.trim()), notes: form.notes.trim() };
      if (isCard) {
        // The server must create a hosted checkout session and return its URL.
        // No card numbers or CVVs are collected or stored in this app.
        const session = await request("/admin/manual-card-checkout", common);
        if (!session.checkout_url || !/^https:\/\//i.test(session.checkout_url)) throw new Error("The payment provider did not return a secure checkout URL.");
        window.location.assign(session.checkout_url);
        return;
      }
      // Existing cash-only backend accepts cash_received. M-PESA requires the NEW
      // server route to validate the receipt with the provider, not a checkbox alone.
      const result = await request("/admin/manual-bookings", {
        ...common,
        payment_method: form.payment_method,
        amount_received: amount,
        payment_reference: form.payment_reference.trim(),
        payment_verified: form.payment_verified,
        ...(isCash ? { cash_received: amount, cash_verified: form.payment_verified } : {})
      });
      setReceipt(result);
      setOpen(false);
      setForm(initial());
      await onSaved();
    } catch (err) {
      setMessage(err.message);
      onError(err.message);
    } finally { setBusy(false); }
  }

  const setGuestCount = value => {
    const count = Math.max(1, Math.min(50, Math.trunc(Number(value) || 1)));
    setForm(f => ({ ...f, guests: count, additional_guests: Array.from({ length: count - 1 }, (_, i) => f.additional_guests[i] || "") }));
  };

  return <>
    <button type="button" className="crm-btn crm-primary" onClick={() => { setMessage(""); setReceipt(null); setOpen(true); }}>＋ Register Guest</button>
    {open && <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#0009", display: "grid", placeItems: "center", padding: 12 }}>
      <form role="dialog" aria-modal="true" aria-label="Register walk-in guest" onSubmit={submit} style={{ background: "#fff", color: "#17383e", width: "min(100%, 620px)", maxHeight: "94vh", overflowY: "auto", padding: 24, borderRadius: 16, display: "grid", gap: 14, boxSizing: "border-box" }}>
        <h2 style={{ margin: 0 }}>Register Guest</h2>
        <p style={{ margin: 0, color: "#557278" }}>Register the booking holder, accompanying guests, and payment method.</p>
        <label style={labelStyle}>Booking holder's full name<input style={fieldStyle} required maxLength={80} value={form.name} onChange={e => update("name", e.target.value)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <label style={labelStyle}>Phone<input style={fieldStyle} required maxLength={20} value={form.phone} onChange={e => update("phone", e.target.value)} /></label>
          <label style={labelStyle}>Email (optional)<input style={fieldStyle} type="email" value={form.email} onChange={e => update("email", e.target.value)} /></label>
        </div>
        <label style={labelStyle}>Cottage<select style={fieldStyle} required value={form.cottage_id} onChange={e => update("cottage_id", e.target.value)}><option value="">Select cottage</option>{cottages.filter(c => Number(c.active) !== 0).map(c => <option key={c.id} value={c.id}>{c.name} — {money(c.nightly_rate ?? c.price)}/night</option>)}</select></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <label style={labelStyle}>Check-in<input style={fieldStyle} type="date" required value={form.check_in} onChange={e => update("check_in", e.target.value)} /></label>
          <label style={labelStyle}>Check-out<input style={fieldStyle} type="date" required min={form.check_in} value={form.check_out} onChange={e => update("check_out", e.target.value)} /></label>
        </div>
        <label style={labelStyle}>Total number of guests (including booking holder)<input style={fieldStyle} type="number" required min={1} max={capacity} value={form.guests} onChange={e => setGuestCount(e.target.value)} /></label>
        {form.additional_guests.length > 0 && <section style={{ background: "#f3f8f6", borderRadius: 10, padding: 14, display: "grid", gap: 10 }}><strong>Other guests staying in this cottage</strong>{form.additional_guests.map((name, index) => <label key={index} style={labelStyle}>Additional guest {index + 1} — full name<input style={fieldStyle} required maxLength={80} value={name} onChange={e => setForm(f => ({ ...f, additional_guests: f.additional_guests.map((v, i) => i === index ? e.target.value : v) }))} /></label>)}</section>}
        <div style={{ background: "#edf6f1", borderRadius: 10, padding: 14 }}><strong>{Math.max(0, nights)} night(s) · Booking total {money(total)}</strong><p style={{ margin: "6px 0 0" }}>Remaining balance: {money(Math.max(0, total - (isCard ? 0 : amount)))}</p></div>
        <label style={labelStyle}>Payment method<select style={fieldStyle} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value, amount_received: "0", payment_reference: "", payment_verified: false }))}><option value="cash">Cash</option><option value="mpesa">M-PESA</option><option value="card">Credit / debit card</option></select></label>
        {isCash && <><label style={labelStyle}>Cash received (KES)<input style={fieldStyle} type="number" min="0" max={total || undefined} step="1" required value={form.amount_received} onChange={e => update("amount_received", e.target.value)} /></label>{amount > 0 && <label style={{ display: "flex", alignItems: "center", gap: 9 }}><input type="checkbox" checked={form.payment_verified} onChange={e => update("payment_verified", e.target.checked)} />I have physically received and counted this cash.</label>}</>}
        {isMpesa && <><label style={labelStyle}>M-PESA amount received (KES)<input style={fieldStyle} type="number" min="0" max={total || undefined} step="1" required value={form.amount_received} onChange={e => update("amount_received", e.target.value)} /></label><label style={labelStyle}>M-PESA receipt number {amount > 0 ? "(required)" : "(required when paid)"}<input style={fieldStyle} required={amount > 0} maxLength={60} placeholder="e.g. transaction receipt" value={form.payment_reference} onChange={e => update("payment_reference", e.target.value.toUpperCase())} /></label>{amount > 0 && <label style={{ display: "flex", alignItems: "center", gap: 9 }}><input type="checkbox" checked={form.payment_verified} onChange={e => update("payment_verified", e.target.checked)} />I have independently verified this receipt against the business M-PESA account.</label>}<small>Server-side receipt validation and duplicate prevention must also be enabled before accepting M-PESA payments.</small></>}
        {isCard && <div style={{ padding: 14, background: "#edf4ff", borderRadius: 10 }}>A secure hosted payment page will open. Card numbers and CVVs are never entered in this admin form. The booking must be confirmed only after the gateway's server-side payment notification.</div>}
        <label style={labelStyle}>Internal notes (optional)<textarea style={fieldStyle} maxLength={300} rows={3} value={form.notes} onChange={e => update("notes", e.target.value)} /></label>
        {message && <p role="alert" style={{ color: "#a22c2c", margin: 0 }}>{message}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}><button type="submit" className="crm-btn crm-primary" disabled={busy || !valid}>{busy ? "Processing…" : isCard ? "Proceed to secure card payment" : "Save guest & booking"}</button><button type="button" className="crm-btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </div>}
    {receipt && <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: "#0009", display: "grid", placeItems: "center", padding: 12 }}><section role="dialog" aria-modal="true" aria-label="Booking acknowledgement" style={{ background: "white", color: "#17383e", padding: 24, borderRadius: 16, width: "min(100%, 480px)" }}><h2>Ewalel Cottages · Booking Acknowledgement</h2><p><b>Booking:</b> {receipt.booking_ref}</p><p><b>Cottage:</b> {receipt.cottage_name}</p><p><b>Stay:</b> {receipt.check_in} to {receipt.check_out}</p><p><b>Booking total:</b> {money(receipt.total)}</p><p><b>Payment received:</b> {money(receipt.amount_received ?? receipt.cash_received)}</p><p><b>Outstanding:</b> {money(receipt.outstanding)}</p><p><b>Receipt:</b> {receipt.receipt || "No payment recorded"}</p><p><b>Status:</b> {String(receipt.status || "pending").replaceAll("_", " ")}</p><small>Internal acknowledgement; not a tax invoice.</small><div style={{ display: "flex", gap: 10, marginTop: 20 }}><button className="crm-btn crm-primary" type="button" onClick={() => window.print()}>Print</button><button className="crm-btn" type="button" onClick={() => setReceipt(null)}>Close</button></div></section></div>}
  </>;
}
