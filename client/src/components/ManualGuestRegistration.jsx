import { useEffect, useState } from "react";

const base = (import.meta.env.VITE_API_URL || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:4000" : window.location.origin)).replace(/\/$/, "");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const initial = () => ({ name: "", phone: "", email: "", cottage_id: "", check_in: today(), check_out: "", check_in_time: "14:00", check_out_time: "10:00", guests: 1, cash_received: "0", cash_verified: false, notes: "" });
const fmt = n => "KES " + Number(n || 0).toLocaleString("en-KE");
const blankGuest = () => ({ name: "", phone: "" });
const capacityOf = cottage => {
  if (!cottage) return null;
  const raw = cottage.max_guests ?? cottage.capacity ?? cottage.cap ?? cottage.max_occupancy;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Dates are treated as local calendar dates, not browser timezone timestamps.
const dateLabel = iso => iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Choose date";
const periodType = (iso, periods) => periods.find(p => p.start <= iso && iso < p.end)?.type || null;
const rangeConflict = (start, end, periods) => periods.find(p => start < p.end && end > p.start);

function AvailabilityCalendar({ cottageId, token, checkIn, checkOut, onDatesChange, onReadyChange }) {
  const [periods, setPeriods] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [month, setMonth] = useState(() => (checkIn || today()).slice(0, 7));
  const [choosing, setChoosing] = useState("checkin");

  useEffect(() => {
    if (cottageId) setMonth((checkIn || today()).slice(0, 7));
  }, [cottageId]);
  const now = today();

  useEffect(() => {
    if (!cottageId || !token) {
      setPeriods([]); setStatus("idle"); setMessage("");
      return;
    }
    const controller = new AbortController();
    setStatus("loading"); setPeriods([]); setMessage("");
    // The backend must provide this endpoint and its real booking/maintenance periods.
    fetch(`${base}/api/admin/cottages/${encodeURIComponent(cottageId)}/availability`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Availability lookup failed (HTTP ${response.status})`);
      const rawPeriods = data.blocked_periods ?? data.blocked;
      if (!Array.isArray(rawPeriods)) throw new Error("Availability response is missing blocked dates.");
      const parsed = rawPeriods.map(p => ({
        start: String(p.start || "").slice(0, 10),
        end: String(p.end || "").slice(0, 10),
        type: p.type === "maintenance" ? "maintenance" : "booking"
      }));
      if (parsed.some(p => !/^\d{4}-\d{2}-\d{2}$/.test(p.start) || !/^\d{4}-\d{2}-\d{2}$/.test(p.end) || p.end <= p.start)) {
        throw new Error("The server returned an invalid availability period.");
      }
      if (!controller.signal.aborted) { setPeriods(parsed); setStatus("ready"); }
    }).catch(err => {
      if (!controller.signal.aborted) { setStatus("error"); setMessage(err.message); }
    });
    return () => controller.abort();
  }, [cottageId, token]);

  useEffect(() => { onReadyChange(status === "ready"); }, [status, onReadyChange]);

  useEffect(() => {
    if (status !== "ready") return;
    if (checkIn && periodType(checkIn, periods)) {
      onDatesChange("", ""); setChoosing("checkin");
      setMessage("Previously selected check-in is unavailable. Choose another date.");
    } else if (checkIn && checkOut && rangeConflict(checkIn, checkOut, periods)) {
      onDatesChange(checkIn, ""); setChoosing("checkout");
      setMessage("Previously selected stay overlaps a blocked period. Choose another check-out date.");
    }
  }, [status, periods, checkIn, checkOut, onDatesChange]);

  const [year, mon] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const title = new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const monthShift = direction => {
    const d = new Date(Date.UTC(year, mon - 1 + direction, 1));
    setMonth(d.toISOString().slice(0, 7)); setMessage("");
  };
  const pick = iso => {
    if (status !== "ready" || iso < now) return;
    const blocked = periodType(iso, periods);
    if (choosing === "checkin" || !checkIn) {
      if (blocked) { setMessage(blocked === "maintenance" ? "Unavailable: cottage maintenance." : "Unavailable: existing guest booking."); return; }
      onDatesChange(iso, ""); setChoosing("checkout"); setMessage("Now select a check-out date."); return;
    }
    if (iso <= checkIn) { setMessage("Check-out must be after check-in. Select another date."); return; }
    const conflict = rangeConflict(checkIn, iso, periods);
    if (conflict) { setMessage(conflict.type === "maintenance" ? "This stay overlaps a maintenance closure." : "This stay overlaps an existing guest booking."); return; }
    onDatesChange(checkIn, iso); setChoosing("checkin"); setMessage("Dates selected. Continue completing the reservation.");
  };
  const swatch = (color, label) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: color, border: "1px solid #ccd9d6" }} />{label}</span>;
  return <section style={{ border: "1px solid #d8e4e1", borderRadius: 12, padding: 14, display: "grid", gap: 12 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
      <div style={{ border: "1px solid #cbd9db", borderRadius: 8, padding: 10 }}><small>CHECK-IN</small><div style={{ fontWeight: 700 }}>{dateLabel(checkIn)}</div></div>
      <div style={{ border: "1px solid #cbd9db", borderRadius: 8, padding: 10 }}><small>CHECK-OUT</small><div style={{ fontWeight: 700 }}>{dateLabel(checkOut)}</div></div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <button type="button" aria-label="Previous month" onClick={() => monthShift(-1)} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 22 }}>‹</button>
      <strong>{title}</strong>
      <button type="button" aria-label="Next month" onClick={() => monthShift(1)} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 22 }}>›</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 4 }}>
      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, color: "#60777b" }}>{d}</div>)}
      {Array.from({ length: offset }, (_, i) => <div key={`blank-${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
        const type = periodType(iso, periods);
        const past = iso < now;
        const inRange = checkIn && checkOut && iso >= checkIn && iso < checkOut;
        const selected = iso === checkIn || iso === checkOut;
        const bg = status !== "ready" ? "#eef1f0" : type === "booking" ? "#f4b9b5" : type === "maintenance" ? "#f2d397" : selected ? "#15565b" : inRange ? "#c8e9dc" : "#edf6f1";
        return <button key={iso} type="button" disabled={!cottageId || status !== "ready" || past} title={type === "booking" ? "Already booked" : type === "maintenance" ? "Maintenance closure" : "Available for selection"} onClick={() => pick(iso)} style={{ height: 34, minWidth: 0, border: selected ? "2px solid #0d3439" : "1px solid transparent", borderRadius: 7, background: bg, color: selected && !type ? "white" : "#17383e", cursor: past || status !== "ready" ? "not-allowed" : "pointer", opacity: past ? .4 : 1, fontWeight: selected ? 700 : 400 }}>{i + 1}</button>;
      })}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{swatch("#f4b9b5", "Booked")}{swatch("#f2d397", "Maintenance")}{swatch("#edf6f1", "Available")}{swatch("#c8e9dc", "Selected stay")}</div>
    {!cottageId && <p style={{ margin: 0, fontSize: 12 }}>Select a cottage to view availability.</p>}
    {status === "loading" && <p role="status" style={{ margin: 0, fontSize: 12 }}>Loading cottage availability…</p>}
    {status === "error" && <p role="alert" style={{ margin: 0, fontSize: 12, color: "#9e2525" }}>Unable to verify availability: {message}. Booking is disabled until availability can be checked.</p>}
    {status === "ready" && message && <p role="status" style={{ margin: 0, fontSize: 12, color: "#15565b" }}>{message}</p>}
    {status === "ready" && <p style={{ margin: 0, fontSize: 11, color: "#60777b" }}>Select check-in, then check-out. Checkout on the start of a new blocked period is permitted.</p>}
  </section>;
}

export default function ManualGuestRegistration({ cottages = [], token, onSaved, onError }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [additionalGuests, setAdditionalGuests] = useState([]);
  const [capacityWarning, setCapacityWarning] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const selected = cottages.find(c => String(c.id) === String(form.cottage_id));
  const maxGuests = capacityOf(selected);
  const guestCount = Number(form.guests) || 1;
  const nights = form.check_in && form.check_out ? Math.round((Date.parse(form.check_out + "T12:00:00Z") - Date.parse(form.check_in + "T12:00:00Z")) / 86400000) : 0;
  const total = Math.max(0, nights) * Number(selected?.nightly_rate ?? selected?.price ?? 0);
  const field = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const changeDates = (check_in, check_out) => setForm(f => ({ ...f, check_in, check_out }));
  const changeAvailabilityReady = ready => setAvailabilityReady(ready);

  function changeGuestCount(value) {
    const requested = Number(value);
    if (!Number.isInteger(requested)) return;
    const safe = Math.max(1, requested);
    if (!selected) {
      setCapacityWarning("Select a cottage before setting the number of guests.");
      return;
    }
    if (!maxGuests) {
      setCapacityWarning("This cottage has no valid maximum guest capacity. Set it in Properties first.");
      return;
    }
    if (safe > maxGuests) {
      setCapacityWarning(`Maximum number of guests reached (${maxGuests}).`);
      return;
    }
    setCapacityWarning(safe === maxGuests ? `Maximum number of guests reached (${maxGuests}).` : "");
    setForm(f => ({ ...f, guests: safe }));
    setAdditionalGuests(previous => Array.from({ length: safe - 1 }, (_, i) => previous[i] || blankGuest()));
  }

  function changeCottage(id) {
    const cottage = cottages.find(c => String(c.id) === String(id));
    const limit = capacityOf(cottage);
    const count = id && limit ? Math.min(guestCount, limit) : 1;
    setForm(f => ({ ...f, cottage_id: id, guests: count, check_in: "", check_out: "" }));
    setAvailabilityReady(false);
    setAdditionalGuests(previous => previous.slice(0, count - 1));
    setCapacityWarning(id && !limit ? "This cottage has no valid maximum guest capacity. Set it in Properties first." : count === limit ? `Maximum number of guests reached (${limit}).` : "");
  }

  function updateAdditionalGuest(index, key, value) {
    setAdditionalGuests(previous => previous.map((guest, i) => i === index ? { ...guest, [key]: value } : guest));
  }

  async function save(e) {
    e.preventDefault();
    setSaveError("");
    if (!selected || !maxGuests) return onError("Select a cottage with a valid maximum guest capacity.");
    if (guestCount > maxGuests || guestCount < 1) return onError(`Maximum number of guests reached (${maxGuests}).`);
    if (additionalGuests.length !== guestCount - 1 || additionalGuests.some(g => !g.name.trim())) return onError("Enter the full name of every accompanying guest.");
    if (!availabilityReady) return onError("Cottage availability has not been verified.");
    if (nights < 1) return onError("Check-out must be after check-in.");
    if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(form.check_in_time) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(form.check_out_time)) return onError("Enter valid scheduled check-in and check-out times.");
    if (Number(form.cash_received) > total) return onError("Cash received cannot exceed the booking total.");
    if (Number(form.cash_received) > 0 && !form.cash_verified) return onError("Verify the cash has been received before saving.");
    setBusy(true);
    try {
      const response = await fetch(`${base}/api/admin/manual-bookings`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, guests: guestCount, additional_guests: additionalGuests.map(g => ({ name: g.name.trim(), phone: g.phone.trim() })), cash_received: Number(form.cash_received) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = result.error || result.message || `Booking failed (HTTP ${response.status})`;
        throw new Error(message);
      }
      // Only an explicit successful response with a booking reference is acknowledged.
      if (!result.booking_ref) {
        throw new Error("The server responded without a booking reference. Check Reservations before trying again to avoid creating a duplicate booking.");
      }
      setReceipt(result);
      setOpen(false);
      setForm(initial());
      setAdditionalGuests([]);
      setCapacityWarning("");
      setSaveError("");
      // A refresh failure must not turn a saved booking into an apparent failure.
      try { await onSaved?.(); }
      catch (refreshError) { console.error("Booking saved, but dashboard refresh failed:", refreshError); }
    } catch (err) {
      const message = err?.message || "Unable to save booking.";
      setSaveError(message);
      onError?.(message);
    } finally { setBusy(false); }
  }
  const inputStyle = { width: "100%", padding: 10, border: "1px solid #cbd9db", borderRadius: 8, boxSizing: "border-box" };
  const labelStyle = { display: "grid", gap: 5, fontSize: 13, fontWeight: 600 };
  return <>
    <button className="crm-btn crm-primary" type="button" onClick={() => { setReceipt(null); setSaveError(""); setOpen(true); }}>＋ Register Walk-in Guest</button>
    {open && <div role="presentation" style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 10000, display: "grid", placeItems: "center", padding: 12 }}>
      <form onSubmit={save} role="dialog" aria-modal="true" aria-label="Register walk-in guest" style={{ background: "white", color: "#17383e", width: "min(100%,620px)", maxHeight: "94vh", overflowY: "auto", padding: 24, borderRadius: 16, display: "grid", gap: 14, boxSizing: "border-box" }}>
        <h2 style={{ margin: 0 }}>Register Walk-in Guest</h2>
        <p style={{ margin: 0 }}>Create a reservation and record cash received at reception.</p>
        <label style={labelStyle}>Guest full name<input style={inputStyle} required maxLength={80} value={form.name} onChange={e => field("name", e.target.value)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
          <label style={labelStyle}>Phone<input style={inputStyle} required maxLength={20} value={form.phone} onChange={e => field("phone", e.target.value)} /></label>
          <label style={labelStyle}>Email (optional)<input style={inputStyle} type="email" value={form.email} onChange={e => field("email", e.target.value)} /></label>
        </div>
        <label style={labelStyle}>Cottage<select style={inputStyle} required value={form.cottage_id} onChange={e => changeCottage(e.target.value)}><option value="">Select cottage</option>{cottages.filter(c => Number(c.active) !== 0).map(c => <option key={c.id} value={c.id}>{c.name} — {fmt(c.nightly_rate ?? c.price)}/night · {capacityOf(c) ?? "Capacity not set"} guests max</option>)}</select></label>
        <AvailabilityCalendar cottageId={form.cottage_id} token={token} checkIn={form.check_in} checkOut={form.check_out} onDatesChange={changeDates} onReadyChange={changeAvailabilityReady} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
          <label style={labelStyle}>Scheduled check-in time (Kenya)
            <input style={inputStyle} type="time" required value={form.check_in_time} onChange={e => field("check_in_time", e.target.value)} />
          </label>
          <label style={labelStyle}>Scheduled check-out time (Kenya)
            <input style={inputStyle} type="time" required value={form.check_out_time} onChange={e => field("check_out_time", e.target.value)} />
          </label>
        </div>
        <p style={{ margin: 0, color: "#537078", fontSize: 12 }}>Scheduled times are editable. Actual arrival and departure times are recorded separately when staff use Check In Guest / Check Out Guest.</p>
        <label style={labelStyle}>Number of guests (including primary guest)
          <input style={inputStyle} type="number" min={1} max={maxGuests ?? undefined} required value={form.guests} onChange={e => changeGuestCount(e.target.value)} />
        </label>
        {selected && maxGuests && <div style={{ fontSize: 12, color: "#537078" }}>{guestCount} of {maxGuests} guest spaces used</div>}
        {capacityWarning && <p role="alert" style={{ margin: 0, fontSize: 13, color: "#a72b24", fontWeight: 600 }}>{capacityWarning}</p>}
        {additionalGuests.length > 0 && <section style={{ display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0, color: "#103f43", fontSize: 17 }}>Additional guest details ({additionalGuests.length})</h3>
          {additionalGuests.map((guest, index) => <div key={index} style={{ padding: 14, border: "1px solid #d6e5e0", borderRadius: 12, background: "#f6faf8", display: "grid", gap: 10 }}>
            <strong>Guest {index + 2}</strong>
            <label style={labelStyle}>Full name<input style={inputStyle} required maxLength={80} placeholder="Enter guest full name" value={guest.name} onChange={e => updateAdditionalGuest(index, "name", e.target.value)} /></label>
            <label style={labelStyle}>Phone (optional)<input style={inputStyle} type="tel" maxLength={20} placeholder="Enter phone number" value={guest.phone} onChange={e => updateAdditionalGuest(index, "phone", e.target.value)} /></label>
          </div>)}
        </section>}
        <div style={{ background: "#edf6f1", padding: 12, borderRadius: 10 }}><b>{Math.max(0, nights)} night(s) · Total {fmt(total)}</b><p style={{ margin: "4px 0 0" }}>Balance after cash: {fmt(Math.max(0, total - Number(form.cash_received || 0)))}</p></div>
        <label style={labelStyle}>Cash received (KES; enter 0 if unpaid)<input style={inputStyle} required type="number" min={0} max={total || undefined} step={1} value={form.cash_received} onChange={e => field("cash_received", e.target.value)} /></label>
        {Number(form.cash_received) > 0 && <label style={{ display: "flex", alignItems: "center", gap: 9 }}><input type="checkbox" required checked={form.cash_verified} onChange={e => field("cash_verified", e.target.checked)} />I have physically received and counted this cash</label>}
        <label style={labelStyle}>Internal notes (optional)<textarea style={inputStyle} maxLength={300} value={form.notes} onChange={e => field("notes", e.target.value)} /></label>
        {saveError && <div role="alert" style={{ background: "#fff1f0", border: "1px solid #f1b7b3", borderRadius: 10, padding: 12, color: "#9e2525", fontSize: 13 }}>
          <strong>Booking not saved</strong>
          <p style={{ margin: "5px 0 0" }}>{saveError}</p>
          {(/already booked|overlap|unavailable/i).test(saveError) && <p style={{ margin: "7px 0 0" }}>This cottage has an overlapping reservation. Check Reservations and choose available dates or another cottage.</p>}
        </div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="crm-btn crm-primary" disabled={busy || !availabilityReady || !selected || !maxGuests || nights < 1 || Number(form.cash_received) > total || additionalGuests.some(g => !g.name.trim())}>{busy ? "Saving…" : "Save guest & booking"}</button><button className="crm-btn" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </div>}
    {receipt && <div role="dialog" aria-label="Booking acknowledgement" style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 10001, display: "grid", placeItems: "center", padding: 12 }}>
      <section style={{ background: "white", color: "#17383e", padding: 24, borderRadius: 16, width: "min(100%,480px)" }}>
        <h2>✓ Booking successfully saved</h2>
        <p>Ewalel Cottages · Booking Acknowledgement</p>
        <p><b>Booking:</b> {receipt.booking_ref}</p><p><b>Guests:</b> {receipt.guests ?? "See reservation details"}</p><p><b>Cottage:</b> {receipt.cottage_name}</p>
        <p><b>Stay:</b> {receipt.check_in} at {receipt.check_in_time} to {receipt.check_out} at {receipt.check_out_time} (Kenya time)</p><p><b>Total:</b> {fmt(receipt.total)}</p>
        <p><b>Cash received:</b> {fmt(receipt.cash_received)}</p><p><b>Outstanding:</b> {fmt(receipt.outstanding)}</p>
        <p><b>Status:</b> {String(receipt.status || "").replaceAll("_", " ")}</p><p><b>Cash receipt:</b> {receipt.receipt || "No cash payment"}</p>
        <p style={{ fontSize: 12 }}>Internal booking acknowledgement; not a tax invoice.</p>
        <div style={{ display: "flex", gap: 10 }}><button className="crm-btn crm-primary" onClick={() => window.print()}>Print</button><button className="crm-btn" onClick={() => setReceipt(null)}>Close</button></div>
      </section>
    </div>}
  </>;
}
