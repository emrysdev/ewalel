// 
import MpesaPayment from "./components/MpesaPayment.jsx";
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
  Instagram
} from "lucide-react";
import "./guest.css";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:4001"
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
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${API}${value}`;
  return value.startsWith("/") ? value : `/${value}`;
}

function today() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

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
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState("2");

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

    if (!nights || checkin < today()) {
      setError("Please select valid booking dates.");
      return;
    }

    if (Number(guests) > Number(cottage.capacity)) {
      setError("Guest count exceeds cottage capacity.");
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
          guests: Number(guests)
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

// async function copyPaymentDetail(value, field) {
//   try {
//     await navigator.clipboard.writeText(String(value));
//     setCopiedField(field);
//   } catch {
//     alert("Unable to copy automatically. Please select and copy the number.");
//   }
// }

async function copyPaymentDetail(value, field) {
  try {
    await navigator.clipboard.writeText(String(value));

    // Show the checkmark after copying
    setCopiedField(field);

    // Reset to the copy icon after 2 seconds
    setTimeout(() => {
      setCopiedField((current) =>
        current === field ? "" : current
      );
    }, 2000);

  } catch (error) {
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
    "Contact"
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
                    <div className="ew-cottage-image">
                      <img
                        src={imageUrl(c.photo_url) ||
                          photos[index % photos.length]}
                        alt={c.name}
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

            <div className="ew-form-grid">
              <label>
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

              <label>
                Check-in
                <input
                  required
                  type="date"
                  min={today()}
                  value={checkin}
                  onChange={(e) => setCheckin(e.target.value)}
                />
              </label>

              <label>
                Check-out
                <input
                  required
                  type="date"
                  min={checkin || today()}
                  value={checkout}
                  onChange={(e) => setCheckout(e.target.value)}
                />
              </label>

              <label>
                Guests
                <input
                  required
                  type="number"
                  min="1"
                  max={cottage?.capacity || 10}
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                />
              </label>
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
              disabled={busy || !nights || !cottage}
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
      {/* {copiedField === "paybill" ? "✓ Copied" : "Copy"} */}
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
  title="Copy account number"
  aria-label="Copy account number"
>
  {copiedField === "account" ? (
    <Check size={16} />
  ) : (
    <Copy size={16} />
  )}
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

      {page === "Contact" && (
        <main className="ew-page ew-contact-page">
          <span className="ew-kicker">GET IN TOUCH</span>
          <h1>We'd love to hear from you.</h1>

          <p>
            Have a question about our cottages, availability
            or your upcoming stay? Our team looks forward
            to welcoming you.
          </p>

          <div className="ew-contact-cards">
            <div>
              <MapPin size={30} />
              <h3>Our location</h3>
              <p>Kenya</p>
            </div>

            <div>
              <Phone size={30} />
              <h3>Reservations</h3>
              <p>Contact Ewalel management for assistance.</p>
            </div>

            <div>
              <Waves size={30} />
              <h3>Stay with us</h3>
              <p>Relax, unwind and enjoy your getaway.</p>
            </div>
          </div>

          <button
            className="ew-primary-button"
            type="button"
            onClick={() => navigate("Book a Stay")}
          >
            Book a Stay <ArrowRight size={18} />
          </button>
        </main>
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
