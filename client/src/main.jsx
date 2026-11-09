
import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";

import {
  LayoutDashboard,
  CalendarDays,
  House,
  Wallet,
  FileBarChart,
  Plus,
  ChevronDown,
  CheckCircle2,
  Wrench,
  Clock,
  Menu,
  X,
} from "lucide-react";

import "./style.css";
import Guest from "./Guest.jsx";
import CottageManagement from "./components/CottageManagement.jsx";

// =====================================================
// API CONFIGURATION
// =====================================================

const isLocal = ["localhost", "127.0.0.1"].includes(
  window.location.hostname
);

const BASE = (
  isLocal
    ? import.meta.env.VITE_API_URL || "http://localhost:4000"
    : window.location.origin
).replace(/\/$/, "");

async function api(path, options = {}, token) {
  let response;

  try {
    response = await fetch(`${BASE}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Unable to connect to the Ewalel server. Check your Railway deployment and API connection."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (HTTP ${response.status})`
    );
  }

  return data;
}

const money = (value) =>
  "KES " + Number(value || 0).toLocaleString("en-KE");

const tabs = [
  ["Overview", LayoutDashboard],
  ["Reservations", CalendarDays],
  ["Cottages", House],
  ["Finance", Wallet],
  ["Reports", FileBarChart],
];

const sections = {
  Overview: ["Dashboard", "Operations"],
  Reservations: ["Bookings", "Guests", "Booking Confirmation"],
  Cottages: ["Manage cottages", "Maintenance"],
  Finance: ["Revenue & payments"],
  Reports: ["Excel reports"],
};

const emptyMaintenance = {
  cottage_id: "",
  task: "",
  scheduled_date: "",
  assigned_to: "",
  estimated_cost: "",
  notes: "",
};

const emptyPayment = {
  booking_id: "",
  method: "mpesa",
  amount: "",
  reference: "",
  status: "pending",
};

// =====================================================
// ADMIN APPLICATION
// =====================================================

function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("ewalel_token") || ""
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [tab, setTab] = useState("Reservations");
  const [sub, setSub] = useState("Bookings");
  const [mobile, setMobile] = useState(false);

  const [cottages, setCottages] = useState([]);
  const [records, setRecords] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);

  const [finance, setFinance] = useState({
    revenue: 0,
    outstanding: 0,
    methods: [],
  });

  const [filter, setFilter] = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const [form, setForm] = useState(emptyMaintenance);
  const [pform, setPform] = useState(emptyPayment);

  // ===================================================
  // LOAD ADMIN DATA
  // ===================================================

  const refresh = useCallback(async () => {
    if (!token) return;

    try {
      const [c, m, b, p, f] = await Promise.all([
        api("/admin/cottages", {}, token),
        api("/admin/maintenance", {}, token),
        api("/admin/bookings", {}, token),
        api("/admin/payments", {}, token),
        api("/admin/finance", {}, token),
      ]);

      setCottages(c);
      setRecords(m);
      setBookings(b);
      setPayments(p);
      setFinance(f);
      setError("");
    } catch (err) {
      if (
        err.message.includes("Administrator sign-in required") ||
        err.message.includes("Invalid token")
      ) {
        sessionStorage.removeItem("ewalel_token");
        setToken("");
      }

      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    refresh();

    const interval = setInterval(refresh, 15000);

    return () => clearInterval(interval);
  }, [refresh, token]);

  async function run(action) {
    try {
      setError("");
      setNotice("");

      await action();
      await refresh();

      setNotice("Saved successfully");
    } catch (err) {
      setError(err.message);
    }
  }

  // ===================================================
  // ADMIN AUTHENTICATION
  // ===================================================

  async function login(e) {
    e.preventDefault();

    if (loginBusy) return;

    setLoginBusy(true);
    setError("");

    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!result.token) {
        throw new Error("The server did not return a login token.");
      }

      sessionStorage.setItem("ewalel_token", result.token);

      setToken(result.token);
      setPassword("");
      setNotice("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    sessionStorage.removeItem("ewalel_token");

    setToken("");
    setError("");
    setNotice("");
    setPassword("");
  }

  // ===================================================
  // MAINTENANCE CALCULATIONS
  // ===================================================

  const completedMaintenance = records.filter(
    (r) => r.status === "completed"
  );

  const scheduledMaintenance = records.filter(
    (r) =>
      r.status === "scheduled" ||
      r.status === "in_progress"
  );

  const maintenanceCost = completedMaintenance.reduce(
    (sum, r) =>
      sum + Number(r.actual_cost ?? r.estimated_cost ?? 0),
    0
  );

  const visibleMaintenance = records.filter((r) => {
    if (filter === "All") return true;

    if (filter === "History") {
      return r.status === "completed";
    }

    if (filter === "Scheduled") {
      return (
        r.status === "scheduled" ||
        r.status === "in_progress"
      );
    }

    return true;
  });

  // ===================================================
  // LOGIN SCREEN
  // ===================================================

  if (!token) {
    return (
      <main className="login">
        <section className="panel">
          <div
            style={{
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            <img
              src="/images/ewalel-logo.png"
              alt="Ewalel Cottages"
              style={{
                width: 120,
                height: 120,
                objectFit: "contain",
                background: "transparent",
              }}
            />
          </div>

          <div className="eyebrow">
            EWALEL COTTAGES
          </div>

          <h1>Admin sign in</h1>

          <p>
            Secure access to the Ewalel Cottages
            management dashboard.
          </p>

          <form onSubmit={login}>
            <div className="fields">
              <label className="wide">
                Email address

                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                />
              </label>

              <label className="wide">
                Password

                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                />
              </label>
            </div>

            <button
              className="primary"
              type="submit"
              disabled={loginBusy}
            >
              {loginBusy ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  }

  // ===================================================
  // ADMIN DASHBOARD
  // ===================================================

  return (
    <>
      <header>
        <div className="header-inner">
          <div className="brand">
            <img
              src="/images/ewalel-logo.png"
              alt="Ewalel Cottages"
              className="admin-brand-logo"
              style={{
                width: 75,
                height: 75,
                objectFit: "contain",
                background: "transparent",
              }}
            />

            <div>
              <strong>Ewalel Admin</strong>
              <small>COTTAGES MANAGEMENT</small>
            </div>
          </div>

          <div className="header-right">
            <span className="demo">
              Ewalel Management System
            </span>

            <button
              className="secondary"
              onClick={logout}
            >
              Sign out
            </button>

            <button
              className="menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Toggle navigation"
            >
              {mobile ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        <nav className={mobile ? "show" : ""}>
          {tabs.map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => {
                setTab(name);
                setSub(sections[name][0]);
                setMobile(false);
                setFormOpen(false);
                setNotice("");
                setError("");
              }}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <div className="breadcrumb">
          ADMINISTRATION / {tab.toUpperCase()} /{" "}
          {sub.toUpperCase()}
        </div>

        <div className="subnav">
          {sections[tab].map((section) => (
            <button
              key={section}
              className={
                sub === section ? "active" : ""
              }
              onClick={() => {
                setSub(section);
                setFormOpen(false);
                setNotice("");
              }}
            >
              {section}
            </button>
          ))}
        </div>

        {error && (
          <div className="notice" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="notice">
            {notice}
          </div>
        )}

        {/* ===========================================
            COTTAGE MANAGEMENT
        =========================================== */}

        {tab === "Cottages" &&
          sub === "Manage cottages" ? (
          <CottageManagement
            cottages={cottages}
            token={token}
            onRefresh={refresh}
          />

        ) : tab === "Cottages" &&
          sub === "Maintenance" ? (
          <>
            <div className="page-title">
              <div>
                <div className="eyebrow">
                  PROPERTY OPERATIONS
                </div>

                <h1>Maintenance management</h1>

                <p>
                  Schedule cottage maintenance,
                  track work and review service history.
                </p>
              </div>

              <button
                className="primary"
                onClick={() =>
                  setFormOpen(!formOpen)
                }
              >
                <Plus size={18} />
                Add maintenance
              </button>
            </div>

            <div className="stats">
              <article>
                <span>Scheduled maintenance</span>

                <div className="stat">
                  <strong>
                    {scheduledMaintenance.length}
                  </strong>

                  <Clock size={24} />
                </div>

                <small>Open work orders</small>
              </article>

              <article>
                <span>Completed maintenance</span>

                <div className="stat">
                  <strong>
                    {completedMaintenance.length}
                  </strong>

                  <CheckCircle2 size={24} />
                </div>

                <small>Historical records</small>
              </article>

              <article>
                <span>Total maintenance spent</span>

                <div className="stat">
                  <strong className="money">
                    {money(maintenanceCost)}
                  </strong>

                  <Wallet size={24} />
                </div>

                <small>Completed work only</small>
              </article>
            </div>

            {formOpen && (
              <section className="panel form-panel">
                <div className="panel-title">
                  <h2>Schedule maintenance</h2>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      setFormOpen(false)
                    }
                    aria-label="Close form"
                  >
                    <X />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();

                    run(async () => {
                      await api(
                        "/admin/maintenance",
                        {
                          method: "POST",
                          body: JSON.stringify(form),
                        },
                        token
                      );

                      setFormOpen(false);
                      setForm(emptyMaintenance);
                    });
                  }}
                >
                  <div className="fields">
                    <label>
                      Cottage

                      <select
                        required
                        value={form.cottage_id}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            cottage_id: e.target.value,
                          })
                        }
                      >
                        <option value="">
                          Choose cottage
                        </option>

                        {cottages.map((c) => (
                          <option
                            key={c.id}
                            value={c.id}
                          >
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Maintenance date

                      <input
                        type="date"
                        required
                        value={form.scheduled_date}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            scheduled_date:
                              e.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="wide">
                      Task

                      <input
                        required
                        value={form.task}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            task: e.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Assigned technician

                      <input
                        value={form.assigned_to}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            assigned_to:
                              e.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Estimated cost (KES)

                      <input
                        type="number"
                        min="0"
                        value={form.estimated_cost}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            estimated_cost:
                              e.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="wide">
                      Notes

                      <textarea
                        rows="3"
                        value={form.notes}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            notes: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>

                  <button
                    className="primary"
                    type="submit"
                  >
                    Save maintenance
                  </button>
                </form>
              </section>
            )}

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Maintenance records</h2>

                  <p>
                    Scheduled work and previous
                    maintenance
                  </p>
                </div>

                <div className="filters">
                  {[
                    "All",
                    "Scheduled",
                    "History",
                  ].map((item) => (
                    <button
                      key={item}
                      className={
                        filter === item
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setFilter(item)
                      }
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="records">
                {visibleMaintenance.length === 0 ? (
                  <p className="empty">
                    No maintenance records found.
                  </p>
                ) : (
                  visibleMaintenance.map((record) => (
                    <article
                      className="record"
                      key={record.id}
                    >
                      <div className="record-top">
                        <div className="record-icon">
                          <Wrench size={20} />
                        </div>

                        <div className="record-body">
                          <h3>{record.task}</h3>

                          <div className="meta">
                            <span>
                              <House size={14} />
                              {record.cottage_name}
                            </span>

                            <span>
                              <CalendarDays
                                size={14}
                              />
                              {String(
                                record.scheduled_date
                              ).slice(0, 10)}
                            </span>
                          </div>
                        </div>

                        <span
                          className={
                            "status " +
                            (record.status ===
                              "completed"
                              ? "complete"
                              : "scheduled")
                          }
                        >
                          {record.status.replace(
                            "_",
                            " "
                          )}
                        </span>
                      </div>

                      <div className="record-bottom">
                        <strong>
                          {money(
                            record.actual_cost ??
                            record.estimated_cost
                          )}
                        </strong>

                        <button
                          onClick={() =>
                            setExpanded(
                              expanded === record.id
                                ? null
                                : record.id
                            )
                          }
                        >
                          Details
                          <ChevronDown size={15} />
                        </button>
                      </div>

                      {expanded === record.id && (
                        <div className="details">
                          <p>
                            <b>Assigned:</b>{" "}
                            {record.assigned_to ||
                              "Not assigned"}
                          </p>

                          <p>
                            <b>Notes:</b>{" "}
                            {record.notes || "None"}
                          </p>

                          {record.status !==
                            "completed" &&
                            record.status !==
                            "cancelled" && (
                              <button
                                className="primary small"
                                onClick={() => {
                                  const entered =
                                    window.prompt(
                                      "Actual cost in KES",
                                      String(
                                        record.estimated_cost ??
                                        0
                                      )
                                    );

                                  if (entered === null)
                                    return;

                                  const actualCost =
                                    Number(entered);

                                  if (
                                    !Number.isFinite(
                                      actualCost
                                    ) ||
                                    actualCost < 0
                                  ) {
                                    setError(
                                      "Enter a valid maintenance cost."
                                    );
                                    return;
                                  }

                                  run(() =>
                                    api(
                                      "/admin/maintenance/" +
                                      record.id,
                                      {
                                        method: "PATCH",
                                        body: JSON.stringify({
                                          status:
                                            "completed",
                                          actual_cost:
                                            actualCost,
                                        }),
                                      },
                                      token
                                    )
                                  );
                                }}
                              >
                                Mark completed
                              </button>
                            )}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </>

        ) : tab === "Reservations" ? (
          <ReservationsPanel
            sub={sub}
            bookings={bookings}
            token={token}
            refresh={refresh}
            setError={setError}
            setNotice={setNotice}
            openConfirmation={() => setSub("Booking Confirmation")}
          />

        ) : tab === "Finance" ||
          tab === "Overview" ? (
          <>
            <div className="page-title">
              <div>
                <h1>
                  {tab === "Finance"
                    ? "Revenue & payments"
                    : "Business overview"}
                </h1>

                <p>
                  Automatically refreshed from
                  MySQL every 15 seconds.
                </p>
              </div>
            </div>

            <div className="stats">
              <article>
                <span>Revenue collected</span>

                <div className="stat">
                  <strong className="money">
                    {money(finance.revenue)}
                  </strong>
                </div>
              </article>

              <article>
                <span>Outstanding payments</span>

                <div className="stat">
                  <strong className="money">
                    {money(finance.outstanding)}
                  </strong>
                </div>
              </article>

              <article>
                <span>Total bookings</span>

                <div className="stat">
                  <strong>
                    {bookings.length}
                  </strong>
                </div>
              </article>
            </div>

            <section className="panel">
              <h2>Revenue by payment method</h2>

              {[
                "mpesa",
                "card",
                "cash",
              ].map((method) => {
                const amount = Number(
                  (finance.methods || []).find(
                    (item) =>
                      item.method === method
                  )?.amount || 0
                );

                const percentage =
                  Number(finance.revenue) > 0
                    ? Math.min(
                      100,
                      (amount /
                        Number(finance.revenue)) *
                      100
                    )
                    : 0;

                return (
                  <div
                    className="payment-bar"
                    key={method}
                  >
                    <div>
                      {method.toUpperCase()}{" "}
                      <strong>
                        {money(amount)}
                      </strong>
                    </div>

                    <div className="track">
                      <div
                        style={{
                          width:
                            percentage + "%",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </section>

            {tab === "Finance" && (
              <>
                <section className="panel">
                  <h2>
                    Record verified payment
                  </h2>

                  <p>
                    Only mark a payment as
                    completed after independently
                    verifying the transaction.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();

                      run(async () => {
                        await api(
                          "/admin/payments",
                          {
                            method: "POST",
                            body: JSON.stringify(
                              pform
                            ),
                          },
                          token
                        );

                        setPform(emptyPayment);
                      });
                    }}
                  >
                    <div className="fields">
                      <label>
                        Booking

                        <select
                          required
                          value={pform.booking_id}
                          onChange={(e) =>
                            setPform({
                              ...pform,
                              booking_id:
                                e.target.value,
                            })
                          }
                        >
                          <option value="">
                            Select booking
                          </option>

                          {bookings.map((b) => (
                            <option
                              key={b.id}
                              value={b.id}
                            >
                              #{b.id} —{" "}
                              {b.guest_name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Payment method

                        <select
                          value={pform.method}
                          onChange={(e) =>
                            setPform({
                              ...pform,
                              method:
                                e.target.value,
                            })
                          }
                        >
                          <option value="mpesa">
                            M-PESA
                          </option>

                          <option value="card">
                            Credit / debit card
                          </option>

                          <option value="cash">
                            Cash
                          </option>
                        </select>
                      </label>

                      <label>
                        Amount (KES)

                        <input
                          type="number"
                          min="1"
                          required
                          value={pform.amount}
                          onChange={(e) =>
                            setPform({
                              ...pform,
                              amount:
                                e.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        M-PESA receipt /
                        Payment reference

                        <input
                          value={pform.reference}
                          onChange={(e) =>
                            setPform({
                              ...pform,
                              reference:
                                e.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Status

                        <select
                          value={pform.status}
                          onChange={(e) =>
                            setPform({
                              ...pform,
                              status:
                                e.target.value,
                            })
                          }
                        >
                          <option value="pending">
                            Pending
                          </option>

                          <option value="completed">
                            Completed — verified
                          </option>
                        </select>
                      </label>
                    </div>

                    <button
                      className="primary"
                      type="submit"
                    >
                      Save payment
                    </button>
                  </form>
                </section>

                <section className="panel">
                  <h2>
                    Payment acknowledgement register
                  </h2>

                  {payments.map((payment) => (
                    <div
                      className="record"
                      key={payment.id}
                    >
                      #{payment.id}
                      {" · "}
                      {payment.guest_name}
                      {" · "}
                      {payment.method.toUpperCase()}
                      {" · "}
                      {money(payment.amount)}
                      {" · "}
                      {payment.reference ||
                        "No reference"}
                      {" · "}
                      {payment.status}
                    </div>
                  ))}

                  {payments.length === 0 && (
                    <p>No payments yet.</p>
                  )}
                </section>
              </>
            )}
          </>

        ) : (
          <section className="panel">
            <h1>Reports</h1>

            <p>
              View operational totals in Overview
              and Finance. Excel exports are
              planned for a later release.
            </p>
          </section>
        )}
      </main>
    </>
  );
}

// =====================================================
// RESERVATIONS AND PAYMENT CONFIRMATION
// =====================================================

const reservationStyle = {
  heading: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 22 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 24 },
  metric: { background: "#f5f8f6", border: "1px solid #e0e9e5", borderRadius: 14, padding: 18 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 310px), 1fr))", gap: 16 },
  card: { border: "1px solid #dfe8e4", borderRadius: 14, padding: 20, background: "#fff" },
  field: { display: "grid", gap: 7, fontWeight: 600, fontSize: 13, marginBottom: 16 },
  input: { width: "100%", padding: "11px 12px", border: "1px solid #d3ded9", borderRadius: 9, background: "#fff", color: "#173c42" },
  pill: { fontSize: 11, padding: "5px 10px", borderRadius: 30, background: "#fff3d9", color: "#805513", fontWeight: 700 },
};

function ReservationsPanel({ sub, bookings, token, refresh, setError, setNotice, openConfirmation }) {
  const [search, setSearch] = useState("");
  const [viewBooking, setViewBooking] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedId, setSelectedId] = useState("");
  const [receipt, setReceipt] = useState("");
  const [amount, setAmount] = useState("");
  const [evidence, setEvidence] = useState("");
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [receiptError, setReceiptError] = useState("");
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState("");

  const canCancel = b => ["awaiting_payment", "payment_submitted"].includes(b?.status);

  async function cancelBooking(booking) {
    if (!canCancel(booking) || cancellingId) return;
    const reference = booking.ref || booking.id;
    const confirmed = window.confirm(
      `Cancel booking ${reference} for ${booking.name || booking.guest_name || "this guest"}?\n\nThis changes its status to Cancelled. It does not refund any payments.`
    );
    if (!confirmed) return;

    setCancellingId(booking.id);
    setError("");
    setNotice("");
    try {
      await api(`/admin/bookings/${encodeURIComponent(booking.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      }, token);
      setViewBooking(null);
      await refresh();
      setNotice(`Booking ${reference} has been cancelled.`);
    } catch (err) {
      setError(err.message || "Unable to cancel this booking.");
    } finally {
      setCancellingId(null);
    }
  }

  const rows = Array.isArray(bookings) ? bookings : [];
  const fmtDate = value => value ? String(value).slice(0, 10) : "—";
  const displayName = b => b.name || b.guest_name || "Guest name unavailable";
  const displayTotal = b => b.total ?? b.total_amount ?? null;
  const displayRef = b => b.ref || b.id;
  const eligible = rows.filter(b => ["awaiting_payment", "payment_submitted", "awaiting_confirmation"].includes(b.status));
  const selected = rows.find(b => String(b.id) === String(selectedId));
  const normalizedReceipt = receipt.trim().toUpperCase();
  const pending = receipts.find(r =>
    String(r.receipt_number || "").toUpperCase() === normalizedReceipt &&
    String(r.booking_id) === String(selectedId) && r.status === "pending"
  );

  const loadReceipts = useCallback(async () => {
    setReceiptLoading(true);
    try {
      const result = await api("/admin/mpesa", {}, token);
      setReceipts(Array.isArray(result) ? result : []);
      setReceiptError("");
    } catch (err) {
      setReceiptError(err.message);
    } finally { setReceiptLoading(false); }
  }, [token]);

  useEffect(() => {
    if (sub === "Booking Confirmation") loadReceipts();
  }, [sub, loadReceipts]);

  useEffect(() => {
    if (sub !== "Booking Confirmation" || !reviewBookingId || !receipts.length) return;
    const match = receipts.find(r =>
      r.status === "pending" && String(r.booking_id) === reviewBookingId && r.receipt_number
    );
    if (match) {
      setSelectedId(String(match.booking_id));
      setReceipt(String(match.receipt_number).toUpperCase());
      setAmount("");
      setEvidence("");
      setAttested(false);
    }
  }, [sub, reviewBookingId, receipts]);

  // Receipt numbers originate from the guest payment form, not admin entry.
  function chooseSubmission(item) {
    setSelectedId(String(item.booking_id));
    setReceipt(String(item.receipt_number || "").toUpperCase());
    setAmount("");
    setEvidence("");
    setAttested(false);
    setError("");
    setNotice("");
  }

  async function confirm(e) {
    e.preventDefault();
    setError(""); setNotice("");
    const verifiedAmount = Number(amount);
    if (!pending) { setError("A pending receipt linked to this booking is required."); return; }
    if (!(Number(displayTotal(selected)) > 0)) { setError("Booking total is invalid. Confirmation is blocked."); return; }
    if (!Number.isSafeInteger(verifiedAmount) || verifiedAmount <= 0) {
      setError("Enter a positive whole-number verified amount."); return;
    }
    if (evidence.trim().length < 5 || !attested) {
      setError("Enter independent verification evidence and tick the verification declaration."); return;
    }
    if (!window.confirm(`Confirm ${money(verifiedAmount)} for booking ${displayRef(selected)}?`)) return;
    setBusy(true);
    try {
      await api("/admin/mpesa/verify", {
        method: "POST",
        body: JSON.stringify({
          receipt_number: normalizedReceipt,
          verified_amount: verifiedAmount,
          verification_reference: evidence.trim()
        })
      }, token);
      setNotice("Booking confirmed after verified payment was recorded.");
      setSelectedId(""); setReceipt(""); setAmount(""); setEvidence(""); setAttested(false);
      await Promise.all([loadReceipts(), refresh()]);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const filtered = rows.filter(b => {
    const haystack = [b.ref, b.id, b.name, b.guest_name, b.cottage_name, b.phone]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase()) &&
      (statusFilter === "All" || b.status === statusFilter);
  });
  const statuses = [...new Set(["awaiting_payment", "payment_submitted", "awaiting_confirmation", "confirmed", "cancelled", "checked_in", "checked_out", ...rows.map(b => b.status).filter(Boolean)])];
  // Shared palette: summary tiles and status badges use exactly the same colors.
  const bookingStatusColors = {
    "Total bookings": { bg: "#EAF1EF", border: "#B9D3CB", text: "#123D3D" },
    "Awaiting payment": { bg: "#FFF2D9", border: "#F2D29B", text: "#A45F0A" },
    "Payment submitted": { bg: "#E8F0FF", border: "#BDD3F5", text: "#285D9A" },
    "Awaiting confirmation": { bg: "#F2E9FF", border: "#D8C3F4", text: "#7145A3" },
    "Confirmed": { bg: "#E4F6E9", border: "#B7DEC3", text: "#207044" },
    "Cancelled": { bg: "#FFE9E7", border: "#F1C3BE", text: "#B0443D" },
    "Checked in": { bg: "#DFF5F4", border: "#AFE1DF", text: "#1B7271" },
    "Checked out": { bg: "#EDF0F4", border: "#D1D8E1", text: "#526273" },
  };

  const statusLabel = status => String(status || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
  // const statusColor = status =>
  //   bookingStatusColors[statusLabel(status)] || bookingStatusColors["Total bookings"];
  const statusColor = (status) => {
  const key = String(status || "")
    .replaceAll("_", " ")
    .toLowerCase();

  const match = Object.keys(bookingStatusColors).find(
    (name) => name.toLowerCase() === key
  );

  return match
    ? bookingStatusColors[match]
    : bookingStatusColors["Total bookings"];
};
  const counts = [
    ["Total bookings", rows.length],
    ["Awaiting payment", rows.filter(b => b.status === "awaiting_payment").length],
    ["Payment submitted", rows.filter(b => b.status === "payment_submitted").length],
    ["Awaiting confirmation", rows.filter(b => b.status === "awaiting_confirmation").length],
    ["Confirmed", rows.filter(b => b.status === "confirmed").length],
    ["Cancelled", rows.filter(b => b.status === "cancelled").length],
    ["Checked in", rows.filter(b => b.status === "checked_in").length],
    ["Checked out", rows.filter(b => b.status === "checked_out").length],
  ];

  if (sub === "Booking Confirmation") return (
    <section className="panel" style={{ padding: 28 }}>
      <div style={reservationStyle.heading}>
        <div><div className="eyebrow">RESERVATIONS / PAYMENT REVIEW</div>
          <h1>Booking confirmation</h1>
          <p>Review client-submitted M-PESA receipts and independently verify payments before confirming reservations.</p></div>
        <button type="button" className="secondary" onClick={loadReceipts} disabled={receiptLoading}>Refresh receipts</button>
      </div>
      {receiptError && <p role="alert" style={{ color: "#a33" }}>Could not load M-PESA receipts: {receiptError}</p>}
      <div style={reservationStyle.grid}>
        <div style={reservationStyle.card}>
          <h2>1. Client-submitted payments</h2>
          <p>Receipts below are submitted by guests through the booking/payment page. Select a submission to review it.</p>
          <label style={reservationStyle.field}>Pending receipt submissions
            <select style={reservationStyle.input} value={pending?.trans_id || ""} onChange={e => {
              const found = receipts.find(r => String(r.trans_id) === e.target.value);
              if (found) chooseSubmission(found);
              else { setSelectedId(""); setReceipt(""); }
            }}>
              <option value="">Choose a client-submitted receipt</option>
              {receipts.filter(r => r.status === "pending" && r.receipt_number && (!reviewBookingId || String(r.booking_id) === reviewBookingId)).map(r =>
                <option key={r.trans_id} value={r.trans_id}>
                  {r.booking_reference || r.booking_id} — {r.guest_name || "Guest"} — {r.receipt_number}
                </option>
              )}
            </select>
          </label>
          {pending ? <div style={{ background: "#f5f8f6", padding: 15, borderRadius: 10 }}>
            <p><b>Guest name:</b> {pending.guest_name || displayName(selected || {})}</p>
            <p><b>Booking reference:</b> {pending.booking_reference || displayRef(selected || {})}</p>
            <p><b>Booking created:</b> {selected?.created_at ? new Date(selected.created_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) + " (Kenya time)" : "Unavailable"}</p>
            <p><b>Receipt submitted:</b> {pending.received_at ? new Date(Number(pending.received_at) < 1e12 ? Number(pending.received_at) * 1000 : Number(pending.received_at)).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) + " (Kenya time)" : "Unavailable"}</p>
            <p><b>Phone:</b> {pending.guest_phone || "Unavailable"}</p>
            <p><b>Cottage:</b> {selected?.cottage_name || selected?.unit_id || "Unavailable"}</p>
            <p><b>Stay:</b> {fmtDate(selected?.check_in)} to {fmtDate(selected?.check_out)}</p>
            <p><b>Booking total:</b> {money(selected?.total ?? pending.booking_total)}</p>
            <p><b>Client receipt number:</b> <strong>{pending.receipt_number}</strong></p>
            <p><b>Status:</b> Pending independent verification</p>
          </div> : <p>No receipt selected. Click “Refresh receipts” if a guest has just submitted payment details.</p>}
        </div>
        <form onSubmit={confirm} style={reservationStyle.card}>
          <h2>2. Verify and confirm</h2>
          <p>Check the actual payment in official Safaricom/PayBill records. This form does not query Safaricom automatically.</p>
          <label style={reservationStyle.field}>Verified amount (KES)
            <input style={reservationStyle.input} type="number" min="1" step="1" value={amount} required onChange={e => setAmount(e.target.value)} />
          </label>
          <label style={reservationStyle.field}>Independent verification reference
            <input style={reservationStyle.input} value={evidence} required placeholder="Statement / transaction evidence" onChange={e => setEvidence(e.target.value)} />
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 18 }}>
            <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} />
            <span>I checked the receipt, amount, booking and PayBill recipient against official records.</span>
          </label>
          <button className="primary" type="submit" disabled={busy || !pending || !attested || !(Number(displayTotal(selected)) > 0)}>
            {busy ? "Processing…" : "Confirm booking & payment"}
          </button>
        </form>
      </div>
    </section>
  );

  if (sub === "Guests") return (
    <section className="panel" style={{ padding: 28 }}>
      <h1>Guests</h1><p>Guests associated with existing bookings.</p>
      <div style={reservationStyle.grid}>{rows.map(b => <article key={b.id} style={reservationStyle.card}>
        <strong>{displayName(b)}</strong><p>Booking: {displayRef(b)}</p>
        <p>Cottage: {b.cottage_name || b.unit_id || "—"}</p>
      </article>)}</div>
      {!rows.length && <p>No guests found.</p>}
    </section>
  );

  return <section className="panel" style={{ padding: 28 }}>
    <div style={reservationStyle.heading}>
      <div><div className="eyebrow">RESERVATIONS / BOOKING MANAGEMENT</div>
        <h1>Booking Management</h1><p>Search, view and manage every reservation, including cancelled bookings.</p></div>

      <button className="primary" type="button" onClick={() => { setReviewBookingId(""); openConfirmation(); }}>Review payments & confirm</button>
    </div>
    <div style={reservationStyle.cards}>{counts.map(([label, value]) => <article key={label} style={{ ...reservationStyle.metric, background: bookingStatusColors[label]?.bg || "#F4F7F5", border: `1px solid ${bookingStatusColors[label]?.border || "#DEE7E3"}`, borderLeft: `5px solid ${bookingStatusColors[label]?.text || "#123D3D"}` }}>
      <div style={{ fontSize: 13, color: bookingStatusColors[label]?.text || "#607b77", fontWeight: 600 }}>{label}</div>
      <strong style={{ fontSize: 30, color: bookingStatusColors[label]?.text || "#123b40" }}>{value}</strong>
    </article>)}</div>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
      <input aria-label="Search bookings" style={{ ...reservationStyle.input, flex: "2 1 240px" }} placeholder="Search by guest, reference or cottage" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Filter by status" style={{ ...reservationStyle.input, flex: "1 1 180px" }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
        <option value="All">All statuses</option>
        {statuses.map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
      </select>
    </div>
    <div style={reservationStyle.grid}>{filtered.map(b => <article key={b.id} style={reservationStyle.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <strong style={{ fontSize: 14, overflowWrap: "anywhere" }}>#{displayRef(b)}</strong>
        {/* <span style={{
          ...reservationStyle.pill,
          background: statusColor(b.status).bg,
          color: statusColor(b.status).text,
          border: `1px solid ${statusColor(b.status).border}`,
          whiteSpace: "nowrap"
        }}>{statusLabel(b.status)}</span> */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 12px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            backgroundColor: statusColor(b.status).bg,
            color: statusColor(b.status).text,
            border: `1px solid ${statusColor(b.status).border}`,
          }}
        >
          {statusLabel(b.status)}
        </span>
      </div>
      <h3 style={{ marginBottom: 8 }}>{displayName(b)}</h3>
      <p style={{ marginBottom: 5 }}><strong>Cottage:</strong> {b.cottage_name || b.unit_id || "—"}</p>
      <p style={{ marginBottom: 5 }}><strong>Stay:</strong> {fmtDate(b.check_in)} – {fmtDate(b.check_out)}</p>
      <p style={{ marginBottom: 16 }}><strong>Total:</strong> {displayTotal(b) == null ? "Unavailable" : money(displayTotal(b))}</p>
      <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
        <button
          type="button"
          onClick={() => setViewBooking(b)}
          style={{
            width: "100%",
            background: "#123D3D",
            color: "#FFFFFF",
            padding: "13px",
            border: "none",
            borderRadius: "10px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          View booking
        </button>

        {canCancel(b) && (
          <button
            type="button"
            disabled={cancellingId === b.id}
            onClick={() => cancelBooking(b)}
            style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              border: "1px solid #b74a4a", background: "#fff5f5",
              color: "#9b2929", fontWeight: 700, cursor: "pointer"
            }}
          >
            {cancellingId === b.id ? "Cancelling..." : "Cancel booking"}
          </button>
        )}

        {eligible.some(x => x.id === b.id) && (
          <button
            className="secondary"
            type="button"
            onClick={() => { setReviewBookingId(String(b.id)); openConfirmation(); }}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px"
            }}
          >
            Review payment
          </button>
        )}
      </div>

    </article>)}</div>
    {!filtered.length && <p>No matching bookings found.</p>}

    {viewBooking && (
      <div
        onClick={() => setViewBooking(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 9999,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px"
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: "520px",
            maxHeight: "85vh",
            overflowY: "auto",
            background: "white",
            borderRadius: "18px",
            padding: "28px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)"
          }}
        >
          <h2 id="booking-title" style={{ color: "#123D3D" }}>
            Booking Details
          </h2>

          <p>
            <strong>Reference:</strong>{" "}
            {displayRef(viewBooking)}
          </p>

          <p>
            <strong>Guest:</strong>{" "}
            {displayName(viewBooking)}
          </p>

          <p>
            <strong>Phone:</strong>{" "}
            {viewBooking.phone || "Not available"}
          </p>

          <p>
            <strong>Cottage:</strong>{" "}
            {viewBooking.cottage_name ||
              viewBooking.unit_id ||
              "Not available"}
          </p>

          <p>
            <strong>Check-in:</strong>{" "}
            {fmtDate(viewBooking.check_in)}
          </p>

          <p>
            <strong>Check-out:</strong>{" "}
            {fmtDate(viewBooking.check_out)}
          </p>

          <p>
            <strong>Guests:</strong>{" "}
            {viewBooking.guests ?? "Not available"}
          </p>

          <p>
            <strong>Total:</strong>{" "}
            {displayTotal(viewBooking) == null
              ? "Unavailable"
              : money(displayTotal(viewBooking))}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {String(viewBooking.status || "Unknown")
              .replaceAll("_", " ")}
          </p>

          {canCancel(viewBooking) && (
            <button
              type="button"
              disabled={cancellingId === viewBooking.id}
              onClick={() => cancelBooking(viewBooking)}
              style={{
                width: "100%", padding: "14px", marginTop: "18px",
                background: "#fff5f5", color: "#9b2929",
                border: "1px solid #b74a4a", borderRadius: "10px",
                cursor: "pointer", fontWeight: 700
              }}
            >
              {cancellingId === viewBooking.id ? "Cancelling..." : "Cancel this booking"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setViewBooking(null)}
            style={{
              width: "100%",
              padding: "14px",
              marginTop: "20px",
              background: "#123D3D",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer"
            }}
          >
            Close
          </button>
        </div>
      </div>
    )}

  </section>;
}

// =====================================================
// ROUTE PUBLIC WEBSITE AND ADMIN DASHBOARD
// =====================================================

createRoot(
  document.getElementById("root")
).render(
  window.location.pathname.startsWith("/admin")
    ? <App />
    : <Guest />
);
