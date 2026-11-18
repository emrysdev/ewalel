// Load the Contact page only when a visitor opens it.
// 
import { Copy, Check, Banknote, Smartphone, LockKeyhole } from "lucide-react";
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

// Lazy-load the Contact page after React has been imported.
const ContactPage = React.lazy(() => import("./components/ContactReviews.jsx").then(module => ({ default: module.ContactPage })));

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
const LOGO_IMAGE = "/images/ewalel-logo-optimized.webp";

const photos = [
  "/images/exterior.jpeg",
  "/images/lounge.jpeg",
  "/images/interior.jpeg",
  "/images/bedroom.jpeg",
  "/images/living-room.jpeg"
];

const money = (value) =>
  "KES " + Number(value || 0).toLocaleString("en-KE");

const formatBookingDate = (iso) => iso
  ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
    })
  : "the selected date";


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


function normalizeBookingTime(value) {
  const time = String(value ?? "").trim();

  // Already in 24-hour format
  const match24 = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (match24) {
    const hour = Number(match24[1]);
    const minute = Number(match24[2]);

    if (hour > 23 || minute > 59) return "";

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  // Convert 12-hour time to 24-hour time
  const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (match12) {
    let hour = Number(match12[1]);
    const minute = Number(match12[2]);
    const period = match12[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute > 59) return "";

    hour = hour % 12;

    if (period === "PM") hour += 12;

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return "";
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
        <img src={items[0]} alt={`${cottage.name} — view photo gallery`} loading="lazy" decoding="async" />
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
              <img src={items[selected]} alt={`${cottage.name} photograph ${selected + 1} of ${items.length}`} decoding="async" />
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
                <img src={url} alt="" loading="lazy" decoding="async" />
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

// One accessible dropdown per time. Values remain HH:MM for the booking API.
function EwalelTimeSelect({ value, onChange, label }) {
  const formatTime = (time) => {
    const [hour, minute] = time.split(":").map(Number);
    const hour12 = hour % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
  };
  const options = Array.from({ length: 48 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 ? 30 : 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  });
  // Preserve a previously chosen custom minute value if it is not on a half-hour.
  if (value && !options.includes(value)) options.push(value);
  options.sort();
  return (
    <div className="ew-time-select ew-time-single">
      <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(time => <option key={time} value={time}>{formatTime(time)}</option>)}
      </select>
    </div>
  );
}

function PublicAvailabilityCalendar({ cottageId, checkIn, checkOut, onDatesChange, onReadyChange }) {
  const [periods, setPeriods] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [month, setMonth] = useState(() => (checkIn || kenyaToday()).slice(0, 7));
  const [choosing, setChoosing] = useState("checkin");
  const now = kenyaToday();
  const currentMonth = now.slice(0, 7);

  useEffect(() => {
    if (!cottageId) {
      setPeriods([]);
      setStatus("idle");
      onReadyChange(false);
      return;
    }
    const controller = new AbortController();
    setPeriods([]);
    setStatus("loading");
    setMessage("");
    onReadyChange(false);
    setMonth((checkIn || kenyaToday()).slice(0, 7));

    fetch(`${API}/api/cottages/${encodeURIComponent(cottageId)}/availability`, {
      signal: controller.signal
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Availability request failed (${response.status})`);
        const raw = data.blocked_periods ?? data.blocked;
        if (!Array.isArray(raw)) throw new Error("Availability data was not returned by the server.");
        const parsed = raw.map(p => ({
          start: String(p.start || "").slice(0, 10),
          end: String(p.end || "").slice(0, 10),
          type: p.type === "maintenance" ? "maintenance" : "booking"
        }));
        if (parsed.some(p => !/^\d{4}-\d{2}-\d{2}$/.test(p.start) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(p.end) || p.end <= p.start)) {
          throw new Error("Invalid blocked dates returned by server.");
        }
        if (!controller.signal.aborted) {
          setPeriods(parsed);
          setStatus("ready");
          onReadyChange(true);
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setStatus("error");
          setMessage(error.message);
          onReadyChange(false);
        }
      });
    return () => controller.abort();
  }, [cottageId, onReadyChange]);

  const conflict = (start, end) => periods.find(p => start < p.end && end > p.start);
  const blockedAt = iso => periods.find(p => p.start <= iso && iso < p.end)?.type;

  useEffect(() => {
    if (status !== "ready") return;
    if (checkIn && (checkIn < kenyaToday() || blockedAt(checkIn))) {
      onDatesChange("", "");
      setChoosing("checkin");
    } else if (checkIn && checkOut && conflict(checkIn, checkOut)) {
      onDatesChange(checkIn, "");
      setChoosing("checkout");
    }
  }, [status, periods, checkIn, checkOut, onDatesChange]);

  const [year, mon] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const monthTitle = new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString("en-GB", {
    month: "long", year: "numeric", timeZone: "UTC"
  });
  const shift = delta => {
    const next = new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7);
    setMonth(next < currentMonth ? currentMonth : next);
    setMessage("");
  };
  const jump = delta => {
    const [y, m] = currentMonth.split("-").map(Number);
    setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7));
    setMessage("");
  };
  const pick = iso => {
    if (status !== "ready" || iso < now) return;
    const blocked = blockedAt(iso);
    if (choosing === "checkin" || !checkIn) {
      if (blocked) {
        setMessage(blocked === "maintenance"
          ? "This cottage is under maintenance on that date."
          : "This cottage is already booked on that date.");
        return;
      }
      onDatesChange(iso, "");
      setChoosing("checkout");
      setMessage("Now choose your check-out date.");
      return;
    }
    if (iso <= checkIn) {
      // Allow a new arrival date to be selected without manually resetting.
      if (!blocked) {
        onDatesChange(iso, "");
        setChoosing("checkout");
        setMessage("Now choose your check-out date.");
      } else {
        setMessage("Please choose an available check-in date.");
      }
      return;
    }
    if (conflict(checkIn, iso)) {
      setMessage("The selected stay overlaps a booked or maintenance period.");
      return;
    }
    onDatesChange(checkIn, iso);
    setChoosing("checkin");
    setMessage("Your dates are selected.");
  };
  const formatDate = iso => iso
    ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
      })
    : "Select date";

  return (
    <section className="ew-availability-calendar ew-calendar-redesign" aria-label="Cottage availability">
      <div className="ew-calendar-intro">
        <strong className="ew-calendar-heading">Cottage availability</strong>
        <small>Select your check-in date, then your check-out date.</small>
      </div>
      <div className="ew-calendar-jump-grid">
        <label>Month
          <select aria-label="Calendar month" value={mon}
            onChange={e => {
              const target = `${year}-${String(e.target.value).padStart(2, "0")}`;
              setMonth(target < currentMonth ? currentMonth : target);
            }}>
            {Array.from({ length: 12 }, (_, i) =>
              <option key={i} value={i + 1}>{new Date(Date.UTC(2026, i, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })}</option>
            )}
          </select>
        </label>
        <label>Year
          <select aria-label="Calendar year" value={year}
            onChange={e => {
              const target = `${e.target.value}-${String(mon).padStart(2, "0")}`;
              setMonth(target < currentMonth ? currentMonth : target);
            }}>
            {Array.from({ length: 11 }, (_, i) => Number(currentMonth.slice(0, 4)) + i)
              .map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      <div className="ew-calendar-month">
        <button type="button" aria-label="Previous month" disabled={month <= currentMonth} onClick={() => shift(-1)}><ChevronLeft size={19}/></button>
        <strong>{monthTitle}</strong>
        <button type="button" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={19}/></button>
      </div>
    
      <div className="ew-calendar-days">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) =>
          <span key={`weekday-${i}`} className="ew-calendar-weekday">{day}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
          const type = blockedAt(iso);
          const past = iso < now;
          const selected = iso === checkIn || iso === checkOut;
          const within = checkIn && checkOut && iso > checkIn && iso < checkOut;
          const canDepartOnBlockedStart = choosing === "checkout" &&
            checkIn && iso > checkIn && periods.some(p => p.start === iso) &&
            !conflict(checkIn, iso);
          const disabled = past || status !== "ready" ||
            (Boolean(type) && !canDepartOnBlockedStart);
          return (
            <button type="button" key={iso} disabled={disabled} onClick={() => pick(iso)}
              aria-pressed={Boolean(selected)}
              title={type === "booking" ? "Booked" : type === "maintenance" ? "Maintenance" : "Available"}
              className={`ew-calendar-day ${type ? `ew-date-${type}` : ""} ${selected ? "ew-date-selected" : ""} ${within ? "ew-date-within" : ""}`}>
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="ew-calendar-legend">
        <span><i className="ew-legend-available"/>Available</span>
        <span><i className="ew-legend-booked"/>Booked</span>
        <span><i className="ew-legend-maintenance"/>Maintenance</span>
        <span><i className="ew-legend-selected"/>Selected stay</span>
      </div>
      {!cottageId && <small>Select a cottage to view availability.</small>}
      {status === "loading" && <small role="status">Loading live cottage availability…</small>}
      {status === "error" && <small role="alert" className="ew-calendar-alert">Unable to verify availability: {message}. Booking is disabled.</small>}
      {status === "ready" && message && <small role="status" className="ew-calendar-feedback">{message}</small>}
      <div className="ew-calendar-selected-dates" aria-live="polite">
        <div><small>Check-in</small><strong>{formatDate(checkIn)}</strong></div>
        <div><small>Check-out</small><strong>{formatDate(checkOut)}</strong></div>
      </div>
      <small className="ew-calendar-footnote">Check-out may coincide with the next guest's arrival.</small>
    </section>
  );
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
          width="180"
          height="130"
          decoding="async"
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


function to24Hour(hour, minute, period) {
  let h = Number(hour);

  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;

  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}


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
  const [guests, setGuests] = useState("1");
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
  const changeCalendarDates = React.useCallback((start, end) => { setCheckin(start); setCheckout(end); setMpesaAcknowledged(false); }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState("mpesa");
  const [mpesaCheckoutPhone, setMpesaCheckoutPhone] = useState("");
  const [cashAcknowledged, setCashAcknowledged] = useState(false);
  const [mpesaAcknowledged, setMpesaAcknowledged] = useState(false);
  const [cardBillingName, setCardBillingName] = useState("");
  const [cardBillingEmail, setCardBillingEmail] = useState("");
  const [bookingStep, setBookingStep] = useState(1);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [stepError, setStepError] = useState("");

  const normalizeGuestName = value =>
    value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

  function continueToPayment() {
    setStepError("");
    const count = Number(guests);
    if (!cottage || !availabilityReady || !checkin || !checkout ||
        nights < 1 || checkin < kenyaToday() || !Number.isFinite(total) || total <= 0) {
      setStepError("Choose an available cottage and valid dates before continuing.");
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > Number(cottage.capacity)) {
      setStepError("Select a guest count within this cottage's capacity.");
      return;
    }
    if (name.trim().split(/\s+/).length < 2 || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !/^[+\d][\d\s().-]{6,19}$/.test(phone.trim())) {
      setStepError("Enter a valid primary guest name, email and phone number.");
      return;
    }
    if (additionalGuests.length !== count - 1 ||
        additionalGuests.some(guest => !guest.name.trim())) {
      setStepError("Enter the full name of every additional guest.");
      return;
    }
    const names = [name, ...additionalGuests.map(guest => guest.name)].map(normalizeGuestName);
    if (new Set(names).size !== names.length) {
      setStepError("Each guest must have a different full name. Please correct duplicate names.");
      return;
    }
    setBookingStep(2);
    window.requestAnimationFrame(() => document.getElementById("ew-payment-section")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // const [result, setResult] = useState(null);
  // const [busy, setBusy] = useState(false);

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const [mpesaReceipt, setMpesaReceipt] = useState("");
  const [mpesaAmountPaid, setMpesaAmountPaid] = useState("");
  const [receiptStatus, setReceiptStatus] = useState("idle");
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
  const countValid = Number.isInteger(Number(guests)) && Number(guests) >= 1 && Number(guests) <= Number(cottage?.capacity || 0);
  const primaryValid = name.trim().split(/\s+/).length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && /^[+\d][\d\s().-]{6,19}$/.test(phone.trim());
  const allNames = [name, ...additionalGuests.map(guest => guest.name)].map(value => value.trim().replace(/\s+/g, " ").toLocaleLowerCase());
  const guestNamesValid = countValid && additionalGuests.length === Number(guests) - 1 && additionalGuests.every(guest => guest.name.trim().split(/\s+/).length >= 2) && new Set(allNames).size === allNames.length;
  const bookingDetailsReady = Boolean(cottage && availabilityReady && checkin && checkout && nights > 0 && total > 0 && checkin >= kenyaToday());
  const readyForPayment = bookingDetailsReady && primaryValid && guestNamesValid;
  const mpesaPhoneValid = /^(?:254|0|\+254)[17]\d{8}$/.test(mpesaCheckoutPhone.replace(/\s/g, ""));
  const mpesaPaidAmountValid = !mpesaReceipt.trim() || (mpesaAmountPaid.trim() !== "" && Number.isFinite(Number(mpesaAmountPaid)) && Number(mpesaAmountPaid) > 0);
  const paymentReady = payment === "mpesa" ? (mpesaPhoneValid && mpesaAcknowledged && mpesaPaidAmountValid) : payment === "cash" ? cashAcknowledged : true;

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
    if (payment === "mpesa" && !mpesaAcknowledged) {
      setStepError("Please confirm the M-PESA payment agreement before requesting your reservation.");
      return;
    }
    if (payment === "cash" && !cashAcknowledged) {
      setStepError("Confirm that you understand cash payment is due at the property.");
      return;
    }
    if (payment === "mpesa" && !/^(?:254|0|\+254)7\d{8}$/.test(mpesaCheckoutPhone.replace(/\s/g, "")) &&
        !/^(?:254|0|\+254)1\d{8}$/.test(mpesaCheckoutPhone.replace(/\s/g, ""))) {
      setStepError("Enter a valid Kenyan M-PESA phone number.");
      return;
    }
    const enteredReceipt = mpesaReceipt.trim().toUpperCase();
    if (payment === "mpesa" && enteredReceipt && !mpesaPaidAmountValid) {
      setStepError("Enter the amount paid for this M-PESA receipt.");
      return;
    }
    if (payment === "mpesa" && enteredReceipt && !/^[A-Z0-9]{8,20}$/.test(enteredReceipt)) {
      setStepError("Enter a valid Safaricom receipt number or leave it blank if you have not paid yet.");
      return;
    }
    if (bookingStep !== 2 || !policyAccepted) {
      setStepError("Complete all booking steps and accept the cancellation policy.");
      return;
    }

    if (!cottage) {
      setError("Please select a cottage.");
      return;
    }

    if (!availabilityReady) { setError("Cottage availability could not be verified. Please try again."); return; }

    if (!nights || checkin < kenyaToday()) {
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

    const allGuestNames = [name, ...additionalGuests.map(guest => guest.name)]
      .map(normalizeGuestName);
    if (new Set(allGuestNames).size !== allGuestNames.length) {
      setError("Duplicate guest names are not allowed.");
      setBookingStep(1);
      return;
    }

    // Ensure the API receives 24-hour HH:MM strings, regardless of the UI display.
    const checkIn24 = normalizeBookingTime(checkinTime);
    const checkOut24 = normalizeBookingTime(checkoutTime);
    if (!checkIn24 || !checkOut24) {
      setError("Please choose valid check-in and check-out times.");
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
          check_in_time: checkIn24,
          check_out_time: checkOut24,
          guests: Number(guests),
          payment_method: payment,
          ...(payment === "mpesa" ? { mpesa_phone: mpesaCheckoutPhone.trim() } : {}),
          additional_guests: additionalGuests.map(guest => ({ name: guest.name.trim() }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create booking");
      }

      setResult(data);
      if (payment === "mpesa" && enteredReceipt) {
        setReceiptStatus("submitting");
        setReceiptBusy(true);
        try {
          if (!data?.id) throw new Error("Booking ID was not returned. Please contact Ewalel to verify your payment.");
          await sendReceiptForBooking(data.id, enteredReceipt);
          setReceiptSubmitted(true);
          setReceiptStatus("submitted");
          setReceiptError("");
        } catch (receiptErr) {
          setReceiptStatus("failed");
          setReceiptError(receiptErr.message);
        } finally {
          setReceiptBusy(false);
        }
      }
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


  async function sendReceiptForBooking(bookingId, receipt) {
    const response = await fetch(`${API}/api/mpesa/submit-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, receipt_number: receipt })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to submit receipt.");
    return data;
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
      await sendReceiptForBooking(result.id, receipt);
      setReceiptSubmitted(true);
      setReceiptStatus("submitted");
      setReceiptError("");
    } catch (err) {
      setReceiptStatus("failed");
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
              width="1600"
              height="900"
              loading="eager"
              fetchPriority="high"
              decoding="async"
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
                loading="lazy"
                decoding="async"
              />
              <img
                src="/images/bedroom.jpeg"
                alt="Ewalel bedroom"
                loading="lazy"
                decoding="async"
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
                    onChange={(e) => changeGuestCount(e.target.value)}
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
                  loading="lazy"
                  decoding="async"
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
            <div className="ew-ux-section-heading"><div><span className="ew-ux-eyebrow">STEP 01 · YOUR STAY</span><h2>Stay details</h2><p>Pick your cottage and dates. We'll calculate the price automatically.</p></div><span className="ew-ux-secure"><ShieldCheck size={16}/> Live availability</span></div>

            
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

  {cottage && (
    <div className="ew-booking-cottage-preview">
      <div className="ew-booking-preview-title"><BedDouble size={17}/> Your cottage</div>
      <div className="ew-booking-preview-content">
        {(cottage.photo_url || photos[0]) && (
          <img src={imageUrl(cottage.photo_url) || photos[0]} alt={`${cottage.name} exterior`} loading="lazy" />
        )}
        <div>
          <strong>{cottage.name}</strong>
          <small>Selected cottage</small>
          <span>{money(cottage.nightly_rate)} / night</span>
        </div>
      </div>
    </div>
  )}

  <PublicAvailabilityCalendar
    cottageId={chosen}
    checkIn={checkin}
    checkOut={checkout}
    onDatesChange={changeCalendarDates}
    onReadyChange={changeAvailabilityReady}
  />

  {/* Dates are selected on the calendar above. Times follow underneath. */}
  <div className="ew-calendar-time-section" style={{ gridColumn: "1 / -1" }}>
    <h3>Arrival and departure times</h3>
    <p className="ew-note">Kenya time (EAT). Standard check-in: 2:00 PM · Check-out: 10:00 AM.</p>
    <div className="ew-calendar-time-grid">
      <label>Check-in time
        <EwalelTimeSelect label="Check-in time" value={checkinTime} onChange={setCheckinTime} />
      </label>
      <label>Check-out time
        <EwalelTimeSelect label="Check-out time" value={checkoutTime} onChange={setCheckoutTime} />
      </label>
    </div>
  </div>

</div>

            <div className="ew-booking-total ew-ux-total" aria-live="polite">
              <div><small>YOUR STAY ESTIMATE</small><span>{nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "Select your dates"} · {cottage?.name || "Choose a cottage"}</span>
                {nights > 0 && <small>{money(cottage?.nightly_rate)} × {nights} night{nights === 1 ? "" : "s"}</small>}</div>
              <strong>{money(total)}</strong>
            </div>

            <section className="ew-booking-steps" aria-label="Reservation steps">
              <div className="ew-booking-progress">
                {["Guests & guest information", "Payment"].map((label, index) => (
                  <div key={label}
                    className={`ew-booking-progress-item ${bookingStep === index + 1 ? "active" : ""} ${bookingStep > index + 1 ? "completed" : ""}`}>
                    <span>{bookingStep > index + 1 ? "✓" : index + 1}</span>
                    <small>{label}</small>
                  </div>
                ))}
              </div>

              {bookingStep === 1 && (
                <div className="ew-booking-step-body">
                                     <span className="ew-ux-eyebrow">STEP 02 · WHO IS STAYING?</span>
                   <h2>Number of guests</h2>
                  <p>How many people will be staying at Ewalel Cottages?</p>
                  <label>
                    Number of guests
                    <input type="number" min="0" max={cottage?.capacity || 1}
                      value={guests} onChange={e => { changeGuestCount(e.target.value); setStepError(""); }} />
                  </label>
                  <p className="ew-note">Standard check-in: 2:00 PM · Check-out: 10:00 AM (Kenya time).</p>

                  {Number.isInteger(Number(guests)) && Number(guests) >= 1 &&
                   Number(guests) <= Number(cottage?.capacity || 0) && (
                    <>
                      <h2>Guest information</h2>
                      <p>Enter the primary guest's details and the names of everyone staying.</p>
                      <div className="ew-form-grid">
                        <label>Full name
                                                     <input autoComplete="name" value={name} onChange={e => {setName(e.target.value); setStepError("");}}
                             placeholder="First and last name" maxLength={100} required />
                        </label>
                        <label>Email address
                                                     <input type="email" autoComplete="email" value={email} onChange={e => {setEmail(e.target.value); setStepError("");}}
                             placeholder="you@example.com" required />
                        </label>
                        <label>Phone number
                                                     <input type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e => {setPhone(e.target.value); setStepError("");}}
                             placeholder="e.g. +254 712 345 678" required />
                        </label>
                      </div>
                      {Number(guests) > 1 && (
                        <div className="ew-step-extra-guests">
                          <h3>Additional guests</h3>
                          <p>The primary guest is listed above. Enter the names of the other {Number(guests) - 1} guest(s).</p>
                          {additionalGuests.map((guest, index) => (
                            <label key={index}>Guest {index + 2} — Full name
                              <input type="text" maxLength={80} required
                                placeholder={`Full name of guest ${index + 2}`}
                                value={guest.name}
                                                                 onChange={e => { updateAdditionalGuest(index, e.target.value); setStepError(""); }} />
                            </label>
                          ))}
                        </div>
                      )}
                      <section className="ew-ux-payment-choice" aria-label="Preferred payment method">
                        <h2>Preferred payment method</h2>
                        <p>Choose how you would like to pay. The next step will show the instructions for your selected method.</p>
                  <div className="ew-payment-methods">
                                         {[["mpesa", "M-PESA"], ["card", "Credit / debit card"], ["cash", "Cash"]].map(([value, label]) => (
                                             <label key={value} className={`ew-ux-method ${payment === value ? "selected" : ""}`}>
                         <input type="radio" name="payment" checked={payment === value} onChange={() => {setPayment(value);setMpesaAcknowledged(false);setStepError("");}} />
                         {value === "mpesa" ? <Smartphone size={19}/> : value === "cash" ? <Banknote size={19}/> : <CreditCard size={19}/>}<span>{label}</span>
                         {payment === value && <CheckCircle2 size={17} className="ew-ux-method-check"/>}
                       </label>
                    ))}
                  </div>
                        
<div className="ew-payment-info">
  {payment === "mpesa" && (
    <p>
      M-PESA payment selected. Pay using the
      displayed PayBill and account number.
      Your payment will be verified by
      Ewalel management.
    </p>
  )}

  {payment === "card" && (
    <p>
      Credit / debit card selected.
      Secure card checkout will open when
      the payment gateway is connected.
    </p>
  )}

  {payment === "cash" && (
    <p>
      Cash payment selected.
      Payment will be arranged directly with
      Ewalel Cottages. Your reservation remains
      pending until confirmed by management.
    </p>
  )}
</div>
 </section>
                                             <div className="ew-ux-next-row"><button type="button" className="ew-booking-next" onClick={continueToPayment} disabled={!readyForPayment}>
                         Continue to payment <ArrowRight size={18} />
                       </button><small>{readyForPayment ? "✓ Guest details complete" : "Complete your stay dates and each guest's details to continue"}</small></div>
                       {countValid && primaryValid && !guestNamesValid && additionalGuests.length > 0 && <p className="ew-ux-hint" role="status">Each guest needs a unique first and last name.</p>}
                    </>
                  )}
                </div>
              )}

              {bookingStep === 2 && (
                                 <div className="ew-booking-step-body" id="ew-payment-section">
                   <span className="ew-ux-eyebrow">STEP 03 · PAYMENT INSTRUCTIONS</span>
                   <h2>Payment instructions</h2>
                   <p>{Number(guests)} guest(s) · {name} · {email}</p>
                   <p className="ew-note">Selected method: {payment === "mpesa" ? "M-PESA" : payment === "card" ? "Credit / debit card" : "Cash"}. <button type="button" className="ew-ux-change-method" onClick={() => { setBookingStep(1); setStepError(""); }}>Change payment method</button></p>
                  {payment === "mpesa" && (
                    <div className="ew-payment-panel ew-mpesa-payment-panel">
                      <h3>M-PESA payment</h3>
                      <p>Use Lipa na M-PESA &rarr; PayBill to pay Ewalel Cottages. Copy the numbers below to avoid typing errors.</p>

                      <div className="ew-mpesa-payment-detail">
                        <span>Business / PayBill number</span>
                        <div className="ew-copy-field">
                          <strong>{MPESA_PAYBILL}</strong>
                          <button type="button" className="ew-copy-btn"
                            onClick={() => copyPaymentDetail(MPESA_PAYBILL, "step-paybill")}
                            aria-label="Copy M-PESA PayBill number">
                            {copiedField === "step-paybill" ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                          </button>
                        </div>
                      </div>

                      <div className="ew-mpesa-payment-detail">
                        <span>Account number</span>
                        <div className="ew-copy-field">
                          <strong>{MPESA_ACCOUNT}</strong>
                          <button type="button" className="ew-copy-btn"
                            onClick={() => copyPaymentDetail(MPESA_ACCOUNT, "step-account")}
                            aria-label="Copy M-PESA account number">
                            {copiedField === "step-account" ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                          </button>
                        </div>
                      </div>

                      <div className="ew-mpesa-payment-amount">
                        <span>Booking amount</span>
                        <strong>{money(total)}</strong>
                      </div>

                      <h4>How to pay</h4>
                      <ol className="ew-mpesa-instructions">
                        <li>Open M-PESA and select Lipa na M-PESA.</li>
                        <li>Select PayBill and enter the business number above.</li>
                        <li>Enter the account number above.</li>
                        <li>Enter the booking amount shown here.</li>
                        <li>Confirm payment securely on your phone.</li>
                        <li>Keep your Safaricom SMS receipt code and enter it below before requesting your reservation.</li>
                      </ol>

                      <label>M-PESA phone number
                        <input type="tel" value={mpesaCheckoutPhone} onChange={e => setMpesaCheckoutPhone(e.target.value)}
                          placeholder="07XXXXXXXX" autoComplete="tel" required />
                      </label>
                      <div className="ew-mpesa-receipt-entry">
                        <label htmlFor="ew-inline-mpesa-receipt">M-PESA Receipt Number (if already paid)
                          <input id="ew-inline-mpesa-receipt" type="text" maxLength={20}
                            value={mpesaReceipt}
                            onChange={e => { setMpesaReceipt(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setMpesaAcknowledged(false); setStepError(""); }}
                            placeholder="Enter Safaricom receipt number" autoComplete="off" />
                        </label>
                        <small>Enter the code from your Safaricom SMS. You can also request a reservation before paying; it will remain pending.</small>
                        <label htmlFor="ew-inline-mpesa-amount" style={{ marginTop: 14 }}>
                          Amount paid via M-PESA (KES) {mpesaReceipt.trim() ? "— required" : "— if already paid"}
                          <input id="ew-inline-mpesa-amount" type="number" inputMode="decimal"
                            min="0.01" step="0.01" value={mpesaAmountPaid}
                            onChange={e => { setMpesaAmountPaid(e.target.value); setMpesaAcknowledged(false); setStepError(""); }}
                            placeholder={`e.g. ${Number(total).toLocaleString("en-KE")}`}
                            required={Boolean(mpesaReceipt.trim())} />
                        </label>
                        <small>Booking total: <strong>{money(total)}</strong>. Enter the amount shown in your Safaricom confirmation SMS. Any difference will require management review.</small>
                      </div>
                      <label className="ew-step-policy-accept" style={{ marginTop: 18, alignItems: "flex-start" }}>
                        <input
                          type="checkbox"
                          checked={mpesaAcknowledged}
                          onChange={e => { setMpesaAcknowledged(e.target.checked); setStepError(""); }}
                          aria-required="true"
                        />
                        <span>
                          {mpesaReceipt.trim() ? (
                            <>
                              I confirm that I have paid <strong>{money(mpesaAmountPaid)}</strong> via M-PESA
                              towards my booking total of <strong>{money(total)}</strong> for my stay from <strong>{formatBookingDate(checkin)}</strong> to
                              {" "}<strong>{formatBookingDate(checkout)}</strong>, using M-PESA receipt
                              number <strong>{mpesaReceipt.trim().toUpperCase()}</strong>.
                              {Number(mpesaAmountPaid) < total && <> I understand that the outstanding balance of <strong>{money(total - Number(mpesaAmountPaid || 0))}</strong> must be settled as agreed with Ewalel management.</>}
                            </>
                          ) : (
                            <>
                              I confirm that I intend to pay <strong>{money(total)}</strong> via M-PESA
                              for my stay from <strong>{formatBookingDate(checkin)}</strong> to
                              {" "}<strong>{formatBookingDate(checkout)}</strong>. I understand that I can
                              request a reservation before paying, but it will remain pending until payment is verified.
                            </>
                          )}
                          {" "}I understand that Ewalel Cottages management must verify the full payment
                          amount and any submitted M-PESA receipt before confirming my reservation.
                          {" "}I understand that cancellation requests must be made
                          <strong> more than 48 hours before my scheduled check-in time</strong> (Kenya time).
                          Cancellation at exactly 48 hours or within 48 hours of check-in is not permitted.
                          {" "}If payment cannot be verified, Ewalel management may contact me for clarification,
                          and my reservation will remain pending until the issue is resolved.
                        </span>
                      </label>
                      <p className="ew-note">Manual PayBill payment only. STK Push is not enabled. Do not enter your M-PESA PIN on this website. Payment is pending until verified by Ewalel management.</p>
                    </div>
                  )}
                  {payment === "card" && (
                    <section className="ew-payment-panel ew-card-checkout" aria-label="Card payment details">
                      <div className="ew-card-checkout-heading">
                        <div className="ew-card-checkout-icon"><CreditCard size={23} /></div>
                        <div><h3>Credit / debit card</h3><p>Prepare your details for secure checkout</p></div>
                        <ShieldCheck size={22} aria-label="Secure payment" />
                      </div>
                      <div className="ew-card-amount"><span>Booking total</span><strong>{money(total)}</strong></div>
                      <div className="ew-card-checkout-grid">
                        <label>Cardholder / billing name
                          <input type="text" autoComplete="cc-name" placeholder="Name as shown on card"
                            value={cardBillingName} onChange={e => setCardBillingName(e.target.value)} />
                        </label>
                        <label>Billing email
                          <input type="email" autoComplete="email" placeholder="you@example.com"
                            value={cardBillingEmail} onChange={e => setCardBillingEmail(e.target.value)} />
                        </label>
                      </div>
                      <div className="ew-card-secure-notice"><LockKeyhole size={18} />
                        <span>Card number, expiry date and CVV will be entered only on a verified payment provider's secure checkout page. Ewalel does not collect them here.</span>
                      </div>
                      <div className="ew-card-gateway-placeholder">
                        <CreditCard size={19} /> A secure card-payment link will be emailed to you once Ewalel arranges payment.
                      </div>
                      <p className="ew-note">Select Request reservation to submit your booking. Ewalel will send card-payment instructions to your booking email address. No card will be charged on this page.</p>
                    </section>
                  )}
                  {payment === "cash" && (
                    <div className="ew-payment-panel">
                                             <h3><Banknote size={20} style={{verticalAlign:"middle",marginRight:8}}/>Pay cash at the property</h3>
                      <p>Cash payments are verified by Ewalel management. Your reservation remains pending until approved.</p>
                      <div className="ew-mpesa-payment-amount" aria-live="polite">
                        <span>Cash amount due at check-in</span>
                        <strong>{money(total)}</strong>
                      </div>
                      <label className="ew-step-policy-accept">
                        <input type="checkbox" checked={cashAcknowledged} onChange={e => setCashAcknowledged(e.target.checked)} />
                        <span>
                          I confirm that I will pay the full booking amount of <strong>{money(total)}</strong> in cash
                          before check-in on <strong>{checkin ? new Date(`${checkin}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "my selected check-in date"}</strong>,
                          for my stay from <strong>{checkin || "the selected check-in date"}</strong> to
                          {" "}<strong>{checkout || "the selected check-out date"}</strong>.
                          I understand that Ewalel management must receive and verify my cash payment
                          before I can check in. If I do not pay the full amount, refuse to pay,
                          or fail to arrive, I may be denied check-in and my reservation may be treated
                          as a non-payment or no-show under the property's disclosed booking terms.
                          I understand that cancellation is permitted only when requested
                          <strong> more than 48 hours before my scheduled check-in time</strong>.
                          Cancellation at exactly 48 hours or within 48 hours of check-in is not permitted.
                          Failure to pay, late arrival, or not showing up does not automatically waive
                          this cancellation restriction. Any refund, forfeiture, or additional charge
                          will be determined under Ewalel Cottages' published terms and applicable law.
                          I agree to contact Ewalel management promptly if I expect to arrive late
                          or cannot fulfil my reservation.
                        </span>
                      </label>
                    </div>
                  )}
                  <div className="ew-step-policy">
                    <h3>Cancellation policy</h3>
                    <p>To cancel, contact Ewalel Cottages more than 48 hours before your scheduled check-in time (Kenya time).
                      Cancellation at exactly 48 hours or within 48 hours of check-in is not permitted.
                      Late arrival, non-payment and no-shows do not automatically qualify as cancellations or refunds.
                      Any refund, forfeiture or additional charge is subject to the property's published terms and applicable law.</p>
                  </div>
                  <label className="ew-step-policy-accept">
                    <input type="checkbox" checked={policyAccepted}
                      onChange={e => setPolicyAccepted(e.target.checked)} />
                    I have read and agree to the cancellation policy.
                  </label>
                                     <div className="ew-ux-assurance"><ShieldCheck size={17}/><span>No card information is stored on this form. Reservations are confirmed only after management approval.</span></div>
                   <div className="ew-booking-step-actions">
                    <button type="button" className="ew-booking-back" onClick={() => { setStepError(""); setBookingStep(1); }}>← Back</button>
                    <button type="submit" className="ew-booking-next"
                                             disabled={busy || !policyAccepted || !paymentReady || !readyForPayment}>
                                             {busy ? "Sending your request…" : "Request reservation"} <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}
                             {stepError && <p className="ew-error" role="alert">{stepError}</p>}
              {error && <p className="ew-error" role="alert">{error}</p>}
            </section>
           </form>
         </main>
      )}

      {page === "Confirmation" && (
        <main className="ew-page ew-confirmation">
          <CheckCircle2 size={64} />

          <span className="ew-kicker">
            RESERVATION REQUEST RECEIVED
          </span>

          <h1>Thank you, {name.trim().split(/\s+/)[0]}.</h1>

          <p>
            Your reservation request has been received. Your booking and any submitted payment receipt remain pending verification and management approval.
          </p>

          <div className="ew-booking-total">
            <span>Booking #{result?.ref || result?.id}</span>
            <strong>{money(result?.total)}</strong>
          </div>

          {payment === "card" && (
            <div className="panel ew-payment-panel">
              <h2>Card payment pending</h2>
              <p>Your booking request has been received. Card payment has not been collected. Ewalel management will arrange a secure payment link and send payment instructions to your booking email address.</p>
              <p>Do not email or submit card numbers or CVVs.</p>
            </div>
          )}
          {payment === "cash" && (
            <div className="panel ew-payment-panel">
              <h2>Cash payment</h2>
              <p>Your reservation request has been received. Ewalel management will confirm
                the reservation and arrange cash payment. A receipt will be issued once cash is verified.</p>
            </div>
          )}
          {payment === "mpesa" && (
            <div className="ew-confirmation-payment-status" role="status">
              <CheckCircle2 size={30} />
              <h2>Payment verification</h2>
              {receiptStatus === "submitted" ? (
                <p>Receipt <strong>{mpesaReceipt.trim().toUpperCase()}</strong> has been submitted for verification. Your reservation remains pending until Ewalel management confirms it.</p>
              ) : receiptStatus === "failed" ? (
                <>
                  <p>Your reservation was received, but the receipt could not be submitted automatically. Please retry below.</p>
                  {receiptError && <p className="ew-error" role="alert">{receiptError}</p>}
                  <form onSubmit={submitMpesaReceipt} className="ew-confirmation-retry">
                    <label htmlFor="ew-retry-receipt">Safaricom receipt number</label>
                    <input id="ew-retry-receipt" type="text" value={mpesaReceipt} maxLength={20}
                      onChange={e => setMpesaReceipt(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} required />
                    <button type="submit" className="ew-receipt-save" disabled={receiptBusy}>{receiptBusy ? "Submitting…" : "Retry receipt submission"}</button>
                  </form>
                </>
              ) : (
                <p>No receipt was submitted. Your booking is pending payment and management confirmation. Contact Ewalel for payment assistance.</p>
              )}
            </div>
          )}

          {payment !== "mpesa" && (
            <p>
              Your selected payment method is
              {payment === "card" ? " card" : " cash"}.
              Ewalel management will provide further
              payment instructions by email or phone.
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
      {page === "Contact Us" && (
        <React.Suspense fallback={<main className="ew-page"><p>Loading Contact Us…</p></main>}>
          <ContactPage />
        </React.Suspense>
      )}

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
