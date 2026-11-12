import { ContactPage } from "./components/ContactReviews.jsx";
// 
import { Copy, Check } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  TreePine,
  ShieldCheck,
  MapPin,
  Menu,
  X,
  CalendarDays,
  Users,
  CheckCircle2,
  Phone,
  CreditCard,
  Waves,
  Instagram,
  ChevronLeft,
  ChevronRight,
  Images
} from "lucide-react";
import "./guest.css";

const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API = (
  import.meta.env.VITE_API_URL ||
  (isLocal ? "http://localhost:4000" : window.location.origin)
).replace(/\/$/, "");

// Uploaded photographs are stored on Railway's persistent volume.
// Override VITE_IMAGE_URL if the image-serving domain changes.
const IMAGE_BASE = (
  import.meta.env.VITE_IMAGE_URL ||
  (isLocal ? API : "https://robust-generosity-production-7f17.up.railway.app")
).replace(/\/$/, "");


const PAYBILL = import.meta.env.VITE_MPESA_PAYBILL || "";

// const HERO_IMAGE = "/images/exterior.jpeg";
const HERO_IMAGE = "/images/ewalel-hero1.png";
const LOGO_IMAGE = "/images/ewalel-logo.png";

const photos = [
  "/images/exterior.jpeg",
  "/images/lounge.jpeg",
  "/images/interior.jpeg",
  "/images/bedroom.jpeg",
  "/images/living-room.jpeg"
];

const money = (value) =>
  "KES " + Number(value || 0).toLocaleString("en-KE");


function CopyNumber({ label, number }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      alert("Unable to copy the number.");
    }
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "12px"
    }}>
      <span>{label}:</span>

      <strong>{number}</strong>

      <button
        type="button"
        onClick={handleCopy}
        title={`Copy ${label}`}
        aria-label={`Copy ${label}`}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "5px"
        }}
      >
        {copied ? (
          <Check size={16} color="green" />
        ) : (
          <Copy size={16} />
        )}

        {copied && (
          <small style={{ color: "green" }}>
            Copied!
          </small>
        )}
      </button>
    </div>
  );
}


function imageUrl(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^(data:|blob:)/i.test(raw)) return raw;
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      // Repoint old upload URLs (including www and localhost) to image storage.
      if (url.pathname.startsWith("/uploads/")) {
        return `${IMAGE_BASE}${url.pathname}${url.search}`;
      }
      return raw;
    } catch { return raw; }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.startsWith("/uploads/")) return `${IMAGE_BASE}${path}`;
  return path;
}

// Guest-facing gallery. Uses public photos only; never calls admin endpoints.
function CottageGallery({ cottage, fallback, onBook }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const touchStart = React.useRef(null);

  useEffect(() => {
    let cancelled = false;
    setSelected(0);
    setNotice("");
    const cover = imageUrl(cottage.photo_url) || fallback;
    const embedded = Array.isArray(cottage.photos) ? cottage.photos : [];
    const normalise = (records) => records.map((photo) => {
      const raw = typeof photo === "string" ? photo :
        (photo.photo_url || photo.url || photo.image_url || photo.path || "");
      return imageUrl(raw);
    }).filter(Boolean);
    const unique = (values) => [...new Set(values.filter(Boolean))];
    setItems(unique([cover, ...normalise(embedded)]));
    // Requires a public GET /api/cottages/:id/photos endpoint on the server.
    fetch(`${API}/api/cottages/${encodeURIComponent(cottage.id)}/photos`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Gallery endpoint unavailable");
        const data = await res.json();
        return Array.isArray(data) ? data :
          Array.isArray(data.photos) ? data.photos :
          Array.isArray(data.images) ? data.images : [];
      })
      .then((data) => {
        if (!cancelled) setItems(unique([cover, ...normalise(embedded), ...normalise(data)]));
      })
      .catch(() => {
        if (!cancelled && !embedded.length) setNotice("Additional photos will appear once the public gallery API is enabled.");
      });
    return () => { cancelled = true; };
  }, [cottage.id, cottage.photo_url, cottage.photos, fallback]);

  const previous = () => setSelected((n) => (n - 1 + items.length) % items.length);
  const next = () => setSelected((n) => (n + 1) % items.length);
  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowLeft" && items.length > 1) previous();
      if (event.key === "ArrowRight" && items.length > 1) next();
    };
    document.addEventListener("keydown", onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = oldOverflow; };
  }, [open, items.length]);

  if (!items.length) return null;
  return (
    <>
      <button className="ew-cottage-gallery-trigger" type="button" onClick={() => setOpen(true)}
        aria-label={`View photos of ${cottage.name}`}>
        <img src={items[0]} alt={`${cottage.name} — view photo gallery`} />
        <span className="ew-gallery-view-label"><Images size={16} /> View photos{items.length > 1 ? ` (${items.length})` : ""}</span>
      </button>
      {open && (
        <div className="ew-photo-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <section className="ew-photo-dialog" role="dialog" aria-modal="true" aria-label={`${cottage.name} photo gallery`}>
            <header className="ew-photo-dialog-head">
              <div><h2>{cottage.name}</h2><p>Explore the cottage before booking</p></div>
              <button type="button" className="ew-photo-close" onClick={() => setOpen(false)} aria-label="Close gallery"><X size={22}/></button>
            </header>
            <div className="ew-photo-stage" onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => { if (touchStart.current === null) return; const dx = e.changedTouches[0].clientX - touchStart.current; if (Math.abs(dx) > 45 && items.length > 1) (dx < 0 ? next : previous)(); touchStart.current = null; }}>
              <img src={items[selected]} alt={`${cottage.name} photograph ${selected + 1} of ${items.length}`} />
              {items.length > 1 && <>
                <button type="button" className="ew-photo-arrow ew-photo-prev" onClick={previous} aria-label="Previous photograph"><ChevronLeft size={26}/></button>
                <button type="button" className="ew-photo-arrow ew-photo-next" onClick={next} aria-label="Next photograph"><ChevronRight size={26}/></button>
              </>}
              <span className="ew-photo-count">{selected + 1} / {items.length}</span>
            </div>
            {items.length > 1 && <div className="ew-photo-thumbs" aria-label="Select photograph">
              {items.map((url, i) => <button key={`${url}-${i}`} type="button" onClick={() => setSelected(i)}
                className={i === selected ? "ew-photo-thumb active" : "ew-photo-thumb"}
                aria-label={`Show photograph ${i + 1}`} aria-pressed={i === selected}>
                <img src={url} alt="" loading="lazy" />
              </button>)}
            </div>}
            {notice && <p className="ew-photo-notice">{notice}</p>}
            <footer className="ew-photo-dialog-foot"><span>{money(cottage.nightly_rate)} <small>/ night</small></span>
              <button type="button" onClick={() => { setOpen(false); onBook(); }}>Book this cottage <ArrowRight size={17}/></button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function today() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}


// Public availability calendar: reads the same live booking/maintenance data as reception.

// Accessible 12-hour time selection; booking API continues receiving HH:MM.
function EwalelTimeSelect({ value, onChange, label }) {
  const [hour24, minute] = (value || "14:00").split(":").map(Number);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = String(hour24 % 12 || 12).padStart(2, "0");
  const update = (nextHour, nextMinute, nextPeriod) => {
    const h = Number(nextHour) % 12 + (nextPeriod === "PM" ? 12 : 0);
    onChange(`${String(h).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`);
  };
  return <div className="ew-time-select" role="group" aria-label={label}>
    <select aria-label={`${label} hour`} value={hour12} onChange={e => update(e.target.value, minute, period)}>
      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(h => <option key={h} value={h}>{h}</option>)}
    </select>
    <select aria-label={`${label} minute`} value={String(minute).padStart(2, "0")} onChange={e => update(hour12, e.target.value, period)}>
      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(m => <option key={m} value={m}>{m}</option>)}
    </select>
    <select aria-label={`${label} AM or PM`} value={period} onChange={e => update(hour12, minute, e.target.value)}>
      <option value="AM">AM</option><option value="PM">PM</option>
    </select>
  </div>;
}

function PublicAvailabilityCalendar({ cottageId, checkIn, checkOut, onDatesChange, onReadyChange }) {
  const [periods, setPeriods] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [month, setMonth] = useState(() => (checkIn || kenyaToday()).slice(0, 7));
  const [choosing, setChoosing] = useState("checkin");
  const now = kenyaToday();

  useEffect(() => {
    if (!cottageId) { setPeriods([]); setStatus("idle"); onReadyChange(false); return; }
    const controller = new AbortController();
    setPeriods([]); setStatus("loading"); setMessage(""); onReadyChange(false);
    setMonth(kenyaToday().slice(0, 7));
    fetch(`${API}/api/cottages/${encodeURIComponent(cottageId)}/availability`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Availability request failed (${response.status})`);
        const raw = data.blocked_periods ?? data.blocked;
        if (!Array.isArray(raw)) throw new Error("Availability data was not returned by the server.");
        const parsed = raw.map(p => ({ start: String(p.start || "").slice(0, 10), end: String(p.end || "").slice(0, 10), type: p.type === "maintenance" ? "maintenance" : "booking" }));
        if (parsed.some(p => !/^\d{4}-\d{2}-\d{2}$/.test(p.start) || !/^\d{4}-\d{2}-\d{2}$/.test(p.end) || p.end <= p.start)) throw new Error("Invalid blocked dates returned by server.");
        if (!controller.signal.aborted) { setPeriods(parsed); setStatus("ready"); onReadyChange(true); }
      })
      .catch(error => { if (!controller.signal.aborted) { setStatus("error"); setMessage(error.message); onReadyChange(false); } });
    return () => controller.abort();
  }, [cottageId, onReadyChange]);

  const conflict = (start, end) => periods.find(p => start < p.end && end > p.start);
  const blockedAt = iso => periods.find(p => p.start <= iso && iso < p.end)?.type;
  useEffect(() => {
    if (status !== "ready") return;
    if (checkIn && (checkIn < kenyaToday() || blockedAt(checkIn))) { onDatesChange("", ""); setChoosing("checkin"); }
    else if (checkIn && checkOut && conflict(checkIn, checkOut)) { onDatesChange(checkIn, ""); setChoosing("checkout"); }
  }, [status, periods, checkIn, checkOut, onDatesChange]);

  const [year, mon] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const monthTitle = new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const shift = delta => setMonth(new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7));
  const pick = iso => {
    if (status !== "ready" || iso < now) return;
    const blocked = blockedAt(iso);
    if (choosing === "checkin" || !checkIn) {
      if (blocked) { setMessage(blocked === "maintenance" ? "This cottage is under maintenance on that date." : "This cottage is already booked on that date."); return; }
      onDatesChange(iso, ""); setChoosing("checkout"); setMessage("Now select your check-out date."); return;
    }
    if (iso <= checkIn) { setMessage("Check-out must be after check-in."); return; }
    const overlapping = conflict(checkIn, iso);
    if (overlapping) { setMessage("The selected stay overlaps a booked or maintenance period."); return; }
    onDatesChange(checkIn, iso); setChoosing("checkin"); setMessage("Dates selected. Complete your reservation below.");
  };
  const swatch = (color, text) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}><span style={{ width: 12, height: 12, background: color, borderRadius: 3, border: "1px solid #cbd8d5" }} />{text}</span>;
  return <section className="ew-availability-calendar" aria-label="Cottage availability">
    <strong className="ew-calendar-heading">Cottage availability</strong>
    <div className="ew-calendar-month">
      <button type="button" aria-label="Previous month" onClick={() => shift(-1)} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 25 }}>‹</button>
      <strong>{monthTitle}</strong>
      <button type="button" aria-label="Next month" onClick={() => shift(1)} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 25 }}>›</button>
    </div>
    <div className="ew-calendar-days">
      {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <span key={`weekday-${i}`} className="ew-calendar-weekday">{day}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
        const type = blockedAt(iso);
        const past = iso < now;
        const selected = iso === checkIn || iso === checkOut;
        const within = checkIn && checkOut && iso > checkIn && iso < checkOut;
        const color = status !== "ready" ? "#eef1f0" : type === "booking" ? "#f4b9b5" : type === "maintenance" ? "#f2d397" : selected ? "#15565b" : within ? "#c8e9dc" : "#edf6f1";
        return <button type="button" key={iso} disabled={past || status !== "ready"} onClick={() => pick(iso)} title={type === "booking" ? "Booked" : type === "maintenance" ? "Maintenance" : "Available"} className="ew-calendar-day" style={{ background: color, color: selected && !type ? "white" : "#17383e", opacity: past ? 0.4 : 1, border: selected ? "2px solid #0d3439" : "1px solid transparent", cursor: past || status !== "ready" ? "not-allowed" : "pointer", fontWeight: selected ? 700 : 500 }}>{i + 1}</button>;
      })}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 13 }}>{swatch("#edf6f1", "Available")}{swatch("#f4b9b5", "Booked")}{swatch("#f2d397", "Maintenance")}{swatch("#c8e9dc", "Selected stay")}</div>
    {!cottageId && <small>Select a cottage to view availability.</small>}
    {status === "loading" && <small role="status">Loading live cottage availability…</small>}
    {status === "error" && <small role="alert" style={{ color: "#a32a2a" }}>Unable to verify availability: {message}. Booking is disabled until availability is available.</small>}
    {status === "ready" && message && <small role="status">{message}</small>}
    <small style={{ color: "#64748b" }}>Select check-in first, then check-out. A check-out date may coincide with the next guest's arrival.</small>
  </section>;
}

const kenyaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function Logo({ onClick }) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <button
      type="button"
      className="ew-brand"
      onClick={onClick}
      aria-label="Ewalel Cottages home"
    >
      {!logoFailed ? (
        <img
          className="ew-logo-image"
          src={LOGO_IMAGE}
          alt="Ewalel Cottages"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div className="ew-logo-fallback">
          <span className="ew-logo-symbol">⌂</span>
          <span className="ew-logo-name">EWALEL</span>
          <span className="ew-logo-sub">COTTAGES</span>
        </div>
      )}
    </button>
  );
}

const features = [
  {
    title: "Comfortable Stays",
    description: "Thoughtfully furnished cottages",
    Icon: BedDouble
  },
  {
    title: "Nature & Serenity",
    description: "A peaceful place to unwind",
    Icon: TreePine
  },
  {
    title: "Safe & Secure",
    description: "A relaxing environment",
    Icon: ShieldCheck
  },
  {
    title: "Convenient Location",
    description: "Discover the beauty of Kenya",
    Icon: MapPin
  }
];

export default function Guest() {
  const [page, setPage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);

  const [cottages, setCottages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [chosen, setChosen] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkinTime, setCheckinTime] = useState("14:00");
  const [checkoutTime, setCheckoutTime] = useState("10:00");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState("2");
  const [additionalGuests, setAdditionalGuests] = useState([]);
  function changeGuestCount(value) {
    setGuests(value);
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > 50) return;
    setAdditionalGuests(previous =>
      Array.from({ length: count - 1 }, (_, i) => previous[i] || { name: "" })
    );
  }
  function updateAdditionalGuest(index, value) {
    setAdditionalGuests(previous =>
      previous.map((guest, i) => i === index ? { ...guest, name: value } : guest)
    );
  }
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const changeAvailabilityReady = React.useCallback(value => setAvailabilityReady(value), []);
  const changeCalendarDates = React.useCallback((start, end) => { setCheckin(start); setCheckout(end); }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState("mpesa");

  // const [result, setResult] = useState(null);
  // const [busy, setBusy] = useState(false);

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const [mpesaReceipt, setMpesaReceipt] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptSubmitted, setReceiptSubmitted] = useState(false);

  const MPESA_PAYBILL = import.meta.env.VITE_MPESA_PAYBILL || "522533";
  const MPESA_ACCOUNT = import.meta.env.VITE_MPESA_ACCOUNT || "7845616";


  useEffect(() => {
    let cancelled = false;

    fetch(`${API}/api/cottages`)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load cottages");
        }

        if (!cancelled) {
          setCottages(data);
          if (data.length) setChosen(String(data[0].id));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const cottage = cottages.find(
    (item) => String(item.id) === chosen
  );

  const nights =
    checkin && checkout
      ? Math.max(
        0,
        Math.round(
          (
            new Date(`${checkout}T12:00:00Z`) -
            new Date(`${checkin}T12:00:00Z`)
          ) / 86400000
        )
      )
      : 0;

  const total = Number(cottage?.nightly_rate || 0) * nights;

  useEffect(() => { setCheckin(""); setCheckout(""); setAvailabilityReady(false); }, [chosen]);

  function navigate(nextPage) {
    setPage(nextPage);
    setMenuOpen(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reserve(event) {
    event.preventDefault();
    setError("");

    if (!cottage) {
      setError("Please select a cottage.");
      return;
    }

    if (!availabilityReady) { setError("Cottage availability could not be verified. Please try again."); return; }

    if (!nights || checkin < today()) {
      setError("Please select valid booking dates.");
      return;
    }

    if (Number(guests) > Number(cottage.capacity)) {
      setError("Guest count exceeds cottage capacity.");
      return;
    }

    if (!Number.isInteger(Number(guests)) || Number(guests) < 1) {
      setError("Please enter a valid number of guests.");
      return;
    }
    if (additionalGuests.length !== Number(guests) - 1 ||
        additionalGuests.some(guest => !guest.name.trim())) {
      setError("Please enter the full name of every additional guest.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cottage_id: cottage.id,
          guest_name: name,
          guest_email: email,
          guest_phone: phone,
          check_in: checkin,
          check_out: checkout,
          check_in_time: checkinTime || "14:00",
          check_out_time: checkoutTime || "10:00",
          guests: Number(guests),
          additional_guests: additionalGuests.map(guest => ({ name: guest.name.trim() }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create booking");
      }

      setResult(data);
      navigate("Confirmation");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }


  const [copiedField, setCopiedField] = useState("");

  async function copyPaymentDetail(value, field) {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(field);
    } catch {
      alert("Unable to copy automatically. Please select and copy the number.");
    }
  }


  async function submitMpesaReceipt(event) {
    event.preventDefault();
    setReceiptError("");

    const receipt = mpesaReceipt.trim().toUpperCase();

    if (!result?.id) {
      setReceiptError("Booking information is missing.");
      return;
    }

    if (!/^[A-Z0-9]{8,20}$/.test(receipt)) {
      setReceiptError("Enter a valid M-PESA receipt number.");
      return;
    }

    setReceiptBusy(true);

    try {
      const response = await fetch(
        `${API}/api/mpesa/submit-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            booking_id: result.id,
            receipt_number: receipt
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to submit receipt."
        );
      }

      setReceiptSubmitted(true);
      setReceiptError("");

    } catch (err) {
      setReceiptError(err.message);
    } finally {
      setReceiptBusy(false);
    }
  }


  const navigation = [
    "Home",
    "Cottages",
    "Book a Stay",
    "Contact Us"
  ];

  return (
    <div className="ew-site">

      {/* HEADER */}

      <header className="ew-header">
        <div className="ew-header-inner">
          <Logo onClick={() => navigate("Home")} />

          <div className="ew-navigation-area">
            <div className="ew-tagline">
              STAY <span>•</span> RELAX <span>•</span> EXPLORE
            </div>

            <nav className={menuOpen ? "ew-nav open" : "ew-nav"}>
              {navigation.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={page === item ? "active" : ""}
                  onClick={() => navigate(item)}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="ew-paybill">
            <span className="ew-mpesa">M-PESA</span>

            <div className="ew-paybill-details">
              <small>Pay Bill Number</small>
              <strong>
                {PAYBILL || "522533"}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="ew-mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* HOME */}

      {page === "Home" && (
        <>
          <section className="ew-hero">
            <img
              className="ew-hero-image"
              src={HERO_IMAGE}
              alt="Ewalel Cottages exterior"
            />

            <div className="ew-hero-shade" />

            <div className="ew-hero-content">
              <div className="ew-hero-eyebrow">
                WELCOME TO
              </div>

              <h1>
                EWALEL
                <span>COTTAGES</span>
              </h1>

              <div className="ew-pink-rule" />

              <h2>Your escape into nature.</h2>

              <p>
                Experience peaceful surroundings,
                thoughtfully furnished cottages and
                a memorable stay in Kenya.
              </p>

              <button
                type="button"
                className="ew-primary-button"
                onClick={() => navigate("Book a Stay")}
              >
                Book a Stay
                <span className="ew-button-icon">
                  <ArrowRight size={21} />
                </span>
              </button>
            </div>
          </section>

          {/* AMENITIES */}

          <section className="ew-features">
            <div className="ew-feature-grid">
              {features.map(({ title, description, Icon }) => (
                <div className="ew-feature" key={title}>
                  <Icon size={39} strokeWidth={1.7} />
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* INTRODUCTION */}

          <section className="ew-intro ew-section">
            <div className="ew-intro-copy">
              <span className="ew-kicker">
                THE EWALEL EXPERIENCE
              </span>

              <h2>
                Where comfort
                <em> meets nature.</em>
              </h2>

              <p>
                Discover a welcoming retreat surrounded by
                natural beauty. Whether you're planning a
                weekend escape or a longer getaway, Ewalel
                Cottages offers a peaceful setting to relax
                and reconnect.
              </p>

              <button
                className="ew-dark-button"
                type="button"
                onClick={() => navigate("Cottages")}
              >
                Explore our cottages <ArrowRight size={18} />
              </button>
            </div>

            <div className="ew-intro-photos">
              <img
                src="/images/lounge.jpeg"
                alt="Ewalel lounge"
              />
              <img
                src="/images/bedroom.jpeg"
                alt="Ewalel bedroom"
              />
            </div>
          </section>

          {/* STAY SEARCH */}

          <section className="ew-search-section">
            <div className="ew-search-heading">
              <span className="ew-kicker">PLAN YOUR ESCAPE</span>
              <h2>Find your perfect stay.</h2>
              <p>
                Choose your dates and let your next getaway begin.
              </p>
            </div>

            <div className="ew-search-panel">
              <label>
                <CalendarDays size={19} />
                <span>
                  Check-in
                  <input
                    type="date"
                    min={today()}
                    value={checkin}
                    onChange={(e) => setCheckin(e.target.value)}
                  />
                </span>
              </label>

              <label>
                <CalendarDays size={19} />
                <span>
                  Check-out
                  <input
                    type="date"
                    min={checkin || today()}
                    value={checkout}
                    onChange={(e) => setCheckout(e.target.value)}
                  />
                </span>
              </label>

              <label>
                <Users size={19} />
                <span>
                  Guests
                  <select
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1)
                      .map((number) => (
                        <option key={number} value={number}>
                          {number} {number === 1 ? "Guest" : "Guests"}
                        </option>
                      ))}
                  </select>
                </span>
              </label>

              <button
                className="ew-primary-button"
                type="button"
                onClick={() => {
                  if (!checkin || !checkout || nights < 1) {
                    setError("Choose valid check-in and check-out dates.");
                    return;
                  }
                  navigate("Cottages");
                }}
              >
                Explore cottages <ArrowRight size={18} />
              </button>
            </div>

            {error && (
              <p className="ew-error" role="alert">{error}</p>
            )}

            <p className="ew-note">
              Final availability is checked when you submit a booking.
            </p>
          </section>

          {/* PHOTO GALLERY */}

          <section className="ew-section ew-gallery-section">
            <div className="ew-centered-heading">
              <span className="ew-kicker">DISCOVER EWALEL</span>
              <h2>Made for memorable moments.</h2>
            </div>

            <div className="ew-gallery">
              {photos.slice(1).map((photo, index) => (
                <img
                  key={photo}
                  src={photo}
                  alt={[
                    "Comfortable lounge",
                    "Cottage interior",
                    "Beautiful bedroom",
                    "Relaxing living space"
                  ][index]}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* COTTAGES */}

      {page === "Cottages" && (
        <main className="ew-page">
          <div className="ew-page-heading">
            <span className="ew-kicker">OUR ACCOMMODATION</span>
            <h1>Find your perfect cottage.</h1>
            <p>
              Beautiful spaces, peaceful surroundings and
              comfort throughout your stay.
            </p>
            {checkin && checkout && nights > 0 && (
              <p>
                Your dates: {checkin} to {checkout} · {guests} guests
              </p>
            )}
          </div>

          {error && <p className="ew-error">{error}</p>}

          {loading ? (
            <p>Loading cottages...</p>
          ) : cottages.length === 0 ? (
            <p>No cottages are currently listed.</p>
          ) : (
            <div className="ew-cottage-grid">
              {cottages
                .filter((c) => Number(c.capacity) >= Number(guests))
                .map((c, index) => (
                  <article className="ew-cottage-card" key={c.id}>
                    <div className="ew-cottage-image ew-cottage-image-gallery">
                      <CottageGallery
                        cottage={c}
                        fallback={photos[index % photos.length]}
                        onBook={() => { setChosen(String(c.id)); navigate("Book a Stay"); }}
                      />
                      <span>EW A L E L STAY</span>
                    </div>

                    <div className="ew-cottage-body">
                      <h2>{c.name}</h2>

                      <p className="ew-location">
                        <MapPin size={16} />
                        {c.location}
                      </p>

                      <p>
                        {c.description ||
                          "A comfortable and peaceful retreat at Ewalel Cottages."}
                      </p>

                      <div className="ew-cottage-meta">
                        <Users size={17} />
                        Up to {c.capacity} guests
                      </div>

                      <div className="ew-cottage-bottom">
                        <strong>
                          {money(c.nightly_rate)}
                          <small> / night</small>
                        </strong>

                        <button
                          type="button"
                          onClick={() => {
                            setChosen(String(c.id));
                            navigate("Book a Stay");
                          }}
                        >
                          Book now <ArrowRight size={17} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </main>
      )}

      {/* BOOKING */}

      {page === "Book a Stay" && (
        <main className="ew-page ew-booking-page">
          <div className="ew-page-heading">
            <span className="ew-kicker">YOUR NEXT GETAWAY</span>
            <h1>Reserve your stay.</h1>
            <p>
              Choose your cottage, select your dates and
              send us your reservation request.
            </p>
          </div>

          <form className="ew-booking-form" onSubmit={reserve}>
            <h2>Stay details</h2>

            
<div
  className="ew-form-grid"
  style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
>
  {/* COTTAGE - FULL WIDTH */}
  <label style={{ gridColumn: "1 / -1" }}>
    Cottage
    <select
      required
      value={chosen}
      onChange={(e) => setChosen(e.target.value)}
    >
      <option value="">Select cottage</option>
      {cottages.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} — {money(c.nightly_rate)}/night
        </option>
      ))}
    </select>
  </label>

  {/* CHECK-IN DATE */}
  <label>
    Check-in date
    <input
      required
      type="date"
      min={today()}
      value={checkin}
      onChange={(e) => setCheckin(e.target.value)}
    />
  </label>

  {/* CHECK-IN TIME */}
  <label>
    Check-in time
    <EwalelTimeSelect label="Check-in time" value={checkinTime} onChange={setCheckinTime} />
  </label>

  {/* CHECK-OUT DATE */}
  <label>
    Check-out date
    <input
      required
      type="date"
      min={checkin || today()}
      value={checkout}
      onChange={(e) => setCheckout(e.target.value)}
    />
  </label>

  {/* CHECK-OUT TIME */}
  <label>
    Check-out time
    <EwalelTimeSelect label="Check-out time" value={checkoutTime} onChange={setCheckoutTime} />
  </label>

  <PublicAvailabilityCalendar
    cottageId={chosen}
    checkIn={checkin}
    checkOut={checkout}
    onDatesChange={changeCalendarDates}
    onReadyChange={changeAvailabilityReady}
  />

  {/* NUMBER OF GUESTS - FULL WIDTH */}
  <label style={{ gridColumn: "1 / -1" }}>
    Number of guests
    <input
      required
      type="number"
      min="1"
      max={cottage?.capacity || 10}
      value={guests}
      onChange={(e) => changeGuestCount(e.target.value)}
    />
  </label>

  <p
    style={{
      gridColumn: "1 / -1",
      margin: 0,
      fontSize: 13,
      color: "#64748b"
    }}
  >
    Standard check-in: 2:00 PM · Check-out: 10:00 AM
    (Kenya time).
  </p>
</div>


            <div className="ew-booking-total">
              <span>
                {nights} night(s) · {cottage?.name || "Select cottage"}
              </span>
              <strong>{money(total)}</strong>
            </div>

            <h2>Guest information</h2>

            <div className="ew-form-grid">
              <label>
                Full name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </label>

              <label>
                Email address
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>

              <label>
                Phone number
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your phone number"
                />
              </label>
            </div>

            {Number(guests) > 1 && (
              <section aria-label="Additional guests" style={{
                marginTop: 22, marginBottom: 26, display: "grid", gap: 14
              }}>
                <h3 style={{ margin: 0, color: "#123944", fontSize: 22 }}>
                  Additional guests
                </h3>
                <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                  The primary guest is listed above. Enter the names of the other
                  {Number(guests) - 1 === 1 ? " guest." : ` ${Number(guests) - 1} guests.`}
                </p>
                {additionalGuests.map((guest, index) => (
                  <div key={index} style={{
                    padding: 18, border: "1px solid #d8e4e1",
                    borderRadius: 12, background: "#f6faf8"
                  }}>
                    <label style={{ display: "grid", gap: 9, fontWeight: 600 }}>
                      Guest {index + 2} — Full name
                      <input
                        type="text"
                        required
                        maxLength={80}
                        placeholder={`Full name of guest ${index + 2}`}
                        value={guest.name}
                        onChange={(e) => updateAdditionalGuest(index, e.target.value)}
                        style={{
                          width: "100%", padding: "15px 16px",
                          border: "1px solid #d4dedd", borderRadius: 10,
                          background: "#fff", boxSizing: "border-box"
                        }}
                      />
                    </label>
                  </div>
                ))}
              </section>
            )}

            <h2>Preferred payment method</h2>

            <div className="ew-payment-methods">
              {[
                ["mpesa", "M-PESA"],
                ["card", "Credit / debit card"],
                ["cash", "Cash"]
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === value}
                    onChange={() => setPayment(value)}
                  />
                  <CreditCard size={19} />
                  {label}
                </label>
              ))}
            </div>

            <p className="ew-note">
              Your payment preference is for planning only.
              Payment is not collected by this form.
              Reservations remain pending until confirmed
              by Ewalel management.
            </p>

            {error && (
              <p className="ew-error" role="alert">{error}</p>
            )}

            <button
              type="submit"
              className="ew-primary-button"
              disabled={busy || !nights || !cottage || !availabilityReady}
            >
              {busy ? "Submitting..." : "Request reservation"}
              <ArrowRight size={18} />
            </button>
          </form>
        </main>
      )}

      {/* CONFIRMATION */}

      {/* {page === "Confirmation" && (
        <main className="ew-page ew-confirmation">
          <CheckCircle2 size={64} />

          <span className="ew-kicker">
            RESERVATION REQUEST RECEIVED
          </span>

          <h1>Thank you, {name}.</h1>

          <p>
            Your booking request has been received.
            It is currently pending confirmation and payment.
          </p>

          <div className="ew-booking-total">
            <span>Booking #{result?.id}</span>
            <strong>{money(result?.total)}</strong>
          </div>

          <button
            className="ew-dark-button"
            type="button"
            onClick={() => navigate("Home")}
          >
            Back to homepage <ArrowRight size={18} />
          </button>
        </main>
      )} */}

      {/* CONFIRMATION */}

      {page === "Confirmation" && (
        <main className="ew-page ew-confirmation">
          <CheckCircle2 size={64} />

          <span className="ew-kicker">
            RESERVATION REQUEST RECEIVED
          </span>

          <h1>Thank you, {name}.</h1>

          <p>
            Your reservation has been received.
            Complete your M-PESA payment and submit
            the receipt number below.
          </p>

          <div className="ew-booking-total">
            <span>Booking #{result?.ref || result?.id}</span>
            <strong>{money(result?.total)}</strong>
          </div>

          {payment === "mpesa" && (
            <div
              className="panel"
              style={{
                maxWidth: 480,
                margin: "25px auto",
                padding: 25,
                textAlign: "left"
              }}
            >
              <h2 style={{ textAlign: "center" }}>
                Pay with M-PESA
              </h2>

              <p>Follow these steps on your phone:</p>

              <ol>
                <li>Open M-PESA.</li>
                <li>Select Lipa na M-PESA.</li>
                <li>Select Pay Bill.</li>

                <li>
                  Enter Business Number:
                  <div className="ew-copy-field">
                    <strong>{MPESA_PAYBILL}</strong>
                    <button
                      type="button"
                      className="ew-copy-btn"
                      onClick={() => copyPaymentDetail(MPESA_PAYBILL, "paybill")}
                    >
                      {copiedField === "paybill" ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </li>

                <li>
                  Enter Account Number:
                  <div className="ew-copy-field">
                    <strong>{MPESA_ACCOUNT}</strong>
                    <button
                      type="button"
                      className="ew-copy-btn"
                      onClick={() => copyPaymentDetail(MPESA_ACCOUNT, "account")}
                    >
                      {copiedField === "account" ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </li>

                <li>
                  Enter the amount shown in your
                  booking confirmation.
                </li>
                <li>Enter your M-PESA PIN and pay.</li>
                <li>
                  Copy the transaction receipt number
                  from the Safaricom SMS.
                </li>
              </ol>

              {!receiptSubmitted ? (
                <form onSubmit={submitMpesaReceipt}>
                  <label>
                    M-PESA Receipt Number
                    <input
                      type="text"
                      required
                      minLength={8}
                      maxLength={20}
                      value={mpesaReceipt}
                      onChange={e =>
                        setMpesaReceipt(
                          e.target.value.toUpperCase()
                        )
                      }
                      placeholder="Enter Safaricom receipt number"
                      autoComplete="off"
                    />
                  </label>

                  {receiptError && (
                    <p className="ew-error" role="alert">
                      {receiptError}
                    </p>
                  )}

                  <button
                    className="ew-primary-button"
                    type="submit"
                    disabled={receiptBusy}
                    style={{ marginTop: 16 }}
                  >
                    {receiptBusy
                      ? "Submitting..."
                      : "Submit Payment Receipt"}
                    <ArrowRight size={18} />
                  </button>
                </form>
              ) : (
                <div role="status" style={{ textAlign: "center" }}>
                  <CheckCircle2
                    size={48}
                    color="#24936B"
                  />

                  <h3>Receipt Submitted Successfully</h3>

                  <p>
                    Receipt: <strong>{mpesaReceipt}</strong>
                  </p>

                  <p>
                    Your payment details have been
                    submitted for administrator verification.
                    Your booking is not yet confirmed.
                  </p>
                </div>
              )}
            </div>
          )}

          {payment !== "mpesa" && (
            <p>
              Your selected payment method is
              {payment === "card" ? " card" : " cash"}.
              Ewalel management will provide further
              payment instructions.
            </p>
          )}

          <button
            className="ew-dark-button"
            type="button"
            onClick={() => navigate("Home")}
          >
            Back to homepage <ArrowRight size={18} />
          </button>
        </main>
      )}



      {/* CONTACT */}
      {page === "Contact Us" && <ContactPage />}

      {/* FOOTER */}

      <footer className="ew-footer">
        <div className="ew-footer-inner">
          <div>
            <h2>EWALEL</h2>
            <span>COTTAGES</span>
            <p>Stay · Relax · Explore</p>
          </div>

          <div className="ew-footer-links">
            {navigation.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => navigate(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="ew-footer-info">
            <p>Experience nature. Enjoy comfort.</p>
            <a href="/admin">Management portal</a>
          </div>
        </div>

        <div className="ew-footer-bottom">
          © {new Date().getFullYear()} Ewalel Cottages.
          All rights reserved.
        </div>
      </footer>
    </div>
  );
}
