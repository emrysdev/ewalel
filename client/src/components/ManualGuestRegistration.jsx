import { useState } from "react";

const base = (import.meta.env.VITE_API_URL || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:4000" : window.location.origin)).replace(/\/$/, "");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const initial = () => ({ name: "", phone: "", email: "", cottage_id: "", check_in: today(), check_out: "", guests: 1, cash_received: "0", cash_verified: false, notes: "" });
const fmt = n => "KES " + Number(n || 0).toLocaleString("en-KE");
export default function ManualGuestRegistration({ cottages, token, onSaved, onError }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const selected = cottages.find(c => String(c.id) === form.cottage_id);
  const nights = form.check_in && form.check_out ? Math.round((Date.parse(form.check_out + "T12:00:00Z") - Date.parse(form.check_in + "T12:00:00Z")) / 86400000) : 0;
  const total = Math.max(0, nights) * Number(selected?.nightly_rate ?? selected?.price ?? 0);
  const field = (key, value) => setForm(f => ({ ...f, [key]: value }));
  async function save(e) {
    e.preventDefault();
    if (nights < 1) return onError("Check-out must be after check-in.");
    if (Number(form.cash_received) > 0 && !form.cash_verified) return onError("Verify the cash has been received before saving.");
    setBusy(true);
    try {
      const response = await fetch(`${base}/api/admin/manual-bookings`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, guests: Number(form.guests), cash_received: Number(form.cash_received) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setReceipt(result); setOpen(false); setForm(initial());
      await onSaved();
    } catch (err) { onError(err.message); }
    finally { setBusy(false); }
  }
  const inputStyle = { width: "100%", padding: 10, border: "1px solid #cbd9db", borderRadius: 8 };
  const labelStyle = { display: "grid", gap: 5, fontSize: 13, fontWeight: 600 };
  return <>
    <button className="crm-btn crm-primary" type="button" onClick={() => { setReceipt(null); setOpen(true); }}>＋ Register Walk-in Guest</button>
    {open && <div role="presentation" style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 10000, display: "grid", placeItems: "center", padding: 12 }}>
      <form onSubmit={save} role="dialog" aria-modal="true" aria-label="Register walk-in guest" style={{ background: "white", color: "#17383e", width: "min(100%,620px)", maxHeight: "94vh", overflowY: "auto", padding: 24, borderRadius: 16, display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0 }}>Register Walk-in Guest</h2>
        <p style={{ margin: 0 }}>Create a reservation and record cash received at reception.</p>
        <label style={labelStyle}>Guest full name<input style={inputStyle} required maxLength={80} value={form.name} onChange={e => field("name", e.target.value)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={labelStyle}>Phone<input style={inputStyle} required maxLength={20} value={form.phone} onChange={e => field("phone", e.target.value)} /></label>
          <label style={labelStyle}>Email (optional)<input style={inputStyle} type="email" value={form.email} onChange={e => field("email", e.target.value)} /></label>
        </div>
        <label style={labelStyle}>Cottage<select style={inputStyle} required value={form.cottage_id} onChange={e => field("cottage_id", e.target.value)}><option value="">Select cottage</option>{cottages.filter(c => Number(c.active) !== 0).map(c => <option key={c.id} value={c.id}>{c.name} — {fmt(c.nightly_rate ?? c.price)}/night</option>)}</select></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={labelStyle}>Check-in<input style={inputStyle} required type="date" value={form.check_in} onChange={e => field("check_in", e.target.value)} /></label>
          <label style={labelStyle}>Check-out<input style={inputStyle} required type="date" min={form.check_in} value={form.check_out} onChange={e => field("check_out", e.target.value)} /></label>
        </div>
        <label style={labelStyle}>Number of guests<input style={inputStyle} type="number" min={1} max={selected?.capacity ?? selected?.cap ?? 50} required value={form.guests} onChange={e => field("guests", e.target.value)} /></label>
        <div style={{ background: "#edf6f1", padding: 12, borderRadius: 10 }}><b>{Math.max(0, nights)} night(s) · Total {fmt(total)}</b><p style={{ margin: "4px 0 0" }}>Balance after cash: {fmt(Math.max(0, total - Number(form.cash_received || 0)))}</p></div>
        <label style={labelStyle}>Cash received (KES; enter 0 if unpaid)<input style={inputStyle} required type="number" min={0} max={total || undefined} step={1} value={form.cash_received} onChange={e => field("cash_received", e.target.value)} /></label>
        {Number(form.cash_received) > 0 && <label style={{ display: "flex", alignItems: "center", gap: 9 }}><input type="checkbox" required checked={form.cash_verified} onChange={e => field("cash_verified", e.target.checked)} />I have physically received and counted this cash</label>}
        <label style={labelStyle}>Internal notes (optional)<textarea style={inputStyle} maxLength={300} value={form.notes} onChange={e => field("notes", e.target.value)} /></label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="crm-btn crm-primary" disabled={busy || !selected || nights < 1 || Number(form.cash_received) > total}>{busy ? "Saving…" : "Save guest & booking"}</button><button className="crm-btn" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </div>}
    {receipt && <div role="dialog" aria-label="Booking acknowledgement" style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 10001, display: "grid", placeItems: "center", padding: 12 }}>
      <section style={{ background: "white", color: "#17383e", padding: 24, borderRadius: 16, width: "min(100%,480px)" }}>
        <h2>Ewalel Cottages · Booking Acknowledgement</h2>
        <p><b>Booking:</b> {receipt.booking_ref}</p><p><b>Cottage:</b> {receipt.cottage_name}</p>
        <p><b>Stay:</b> {receipt.check_in} to {receipt.check_out}</p><p><b>Total:</b> {fmt(receipt.total)}</p>
        <p><b>Cash received:</b> {fmt(receipt.cash_received)}</p><p><b>Outstanding:</b> {fmt(receipt.outstanding)}</p>
        <p><b>Status:</b> {receipt.status.replaceAll("_", " ")}</p><p><b>Cash receipt:</b> {receipt.receipt || "No cash payment"}</p>
        <p style={{ fontSize: 12 }}>Internal booking acknowledgement; not a tax invoice.</p>
        <div style={{ display: "flex", gap: 10 }}><button className="crm-btn crm-primary" onClick={() => window.print()}>Print</button><button className="crm-btn" onClick={() => setReceipt(null)}>Close</button></div>
      </section>
    </div>}
  </>;
}
