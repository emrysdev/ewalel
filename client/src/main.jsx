
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
import ManualGuestRegistration from "./components/ManualGuestRegistration.jsx";

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


function getImageUrl(photoUrl) {
  if (!photoUrl) return "";

  // Keep existing full image URLs
  if (/^https?:\/\//i.test(photoUrl)) {
    return photoUrl;
  }

  // Convert relative image paths into backend URLs
  return `${BASE}/${String(photoUrl).replace(/^\/+/, "")}`;
}

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
  } catch (error) {
    console.error("API connection error:", error);

    throw new Error(
      "Unable to connect to the Ewalel server."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Ewalel API error:", {
      endpoint: path,
      status: response.status,
      response: data,
    });

    throw new Error(
      data.error ||
      data.message ||
      `Request failed (HTTP ${response.status})`
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
            cottages={cottages}
            bookings={bookings}
            payments={payments}
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


function CustomerRetention({ bookings, payments, cottages, token, onError, onNotice, refresh }) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState("Overview");
  const [receipts, setReceipts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [events, setEvents] = useState([]);
  
const stayStatus = (booking) => {
  // Support both the crm_guest_stays response and booking_stay_events response.
  const related = events.filter((s) =>
    (s.booking_id != null && String(s.booking_id) === String(booking.id)) ||
    (s.booking_reference != null && booking.ref != null &&
      String(s.booking_reference) === String(booking.ref))
  );

  // A current stay-status record is authoritative when present.
  const direct = related.find((s) =>
    ["not_checked_in", "checked_in", "checked_out"].includes(s.stay_status)
  );
  if (direct) return direct.stay_status;

  // Some backend versions return an event log rather than stay_status.
  const latest = [...related].sort((a, b) => {
    const dateDiff = new Date(b.created_at || 0) - new Date(a.created_at || 0);
    return dateDiff || Number(b.id || 0) - Number(a.id || 0);
  })[0];
  if (latest?.event_type === "check_out") return "checked_out";
  if (latest?.event_type === "check_in") return "checked_in";

  // Other backend versions store the stay state on the booking itself.
  if (["checked_in", "checked_out"].includes(booking.status)) {
    return booking.status;
  }
  return "not_checked_in";
};

  const [busy, setBusy] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });
  const [pref, setPref] = useState({ preferred_cottage: "", special_requests: "", marketing_consent: false });
  const [insights, setInsights] = useState(false);
  const reloadExtra = useCallback(async () => {
    const [r, n, c, e] = await Promise.all([
      api("/admin/mpesa", {}, token).catch(() => []),
      api("/admin/customer-notes", {}, token).catch(() => []),
      api("/admin/customers", {}, token).catch(() => []),
      api("/admin/stays", {}, token).catch(() => [])
    ]);
    setReceipts(Array.isArray(r) ? r : []);
    setNotes(Array.isArray(n) ? n : []);
    setCustomers(Array.isArray(c) ? c : []);
    setEvents(Array.isArray(e) ? e : []);
  }, [token]);
  useEffect(() => { reloadExtra().catch(e => onError(e.message)); }, [reloadExtra]);
  const fmt = n => "KES " + Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 });
  const date = v => { if (!v) return "Not recorded"; const d = new Date(v); return Number.isNaN(+d) ? String(v).slice(0, 16) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }); };
  const norm = v => String(v || "").trim().toLowerCase();
  const phoneKey = v => String(v || "").replace(/[^\d]/g, "");
  const people = new Map();
  // Do not merge guests merely because they share a name.
  const keyFor = b => { const p = phoneKey(b.phone || b.guest_phone), e = norm(b.email || b.guest_email); return p ? "p:" + p : e ? "e:" + e : "b:" + b.id; };
  for (const b of bookings) { const key = keyFor(b); if (!people.has(key)) people.set(key, { key, name: b.name || b.guest_name || "Unnamed guest", phone: b.phone || b.guest_phone || "", email: b.email || b.guest_email || "", bookings: [] }); people.get(key).bookings.push(b); }
  for (const c of customers) { const p = phoneKey(c.phone), e = norm(c.email); const key = p ? "p:" + p : e ? "e:" + e : "c:" + c.id; if (!people.has(key)) people.set(key, { key, name: c.name, phone: c.phone || "", email: c.email || "", bookings: [] }); }
  const profiles = [...people.values()].map(g => {
    const bs = [...g.bookings].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const ids = new Set(bs.map(b => String(b.id)));
    const ps = payments.filter(p => ids.has(String(p.booking_id)) && norm(p.status) === "completed");
    const total = ps.reduce((n, p) => n + Number(p.amount || 0), 0);
    const completed = bs.filter(b => stayStatus(b) === "checked_out").length;
    const cancellations = bs.filter(b => b.status === "cancelled").length;
    const next = bs.filter(b => b.status === "confirmed" && stayStatus(b) !== "checked_out" && new Date(b.check_out) >= new Date()).sort((a, b) => new Date(a.check_in) - new Date(b.check_in))[0];
    const lastStay = bs.filter(b => stayStatus(b) === "checked_out").sort((a, b) => new Date(b.check_out) - new Date(a.check_out))[0];
    const inactive = Boolean(lastStay && !next && (Date.now() - new Date(lastStay.check_out).getTime()) > 180 * 86400000);
    return { ...g, bookings: bs, total, completed, cancellations, next, lastStay, inactive, first: bs.at(-1)?.created_at, last: bs[0]?.created_at, segment: bs.length >= 2 ? "Returning" : "New" };
  });
  const filtered = profiles.filter(g => {
    if (segment === "returning" && g.bookings.length < 2) return false;
    if (segment === "new" && g.bookings.length !== 1) return false;
    if (segment === "inactive" && !g.inactive) return false;
    if (segment === "in-house" && !g.bookings.some(b => stayStatus(b) === "checked_in")) return false;
    if (statusFilter !== "all" && !g.bookings.some(b => ["checked_in", "checked_out"].includes(statusFilter) ? stayStatus(b) === statusFilter : b.status === statusFilter)) return false;
    if (period !== "all" && !g.bookings.some(b => new Date(b.created_at) > new Date(Date.now() - Number(period) * 86400000))) return false;
    return [g.name, g.phone, g.email, ...g.bookings.map(b => b.ref || b.id)].join(" ").toLowerCase().includes(query.toLowerCase());
  });
  const current = profiles.find(g => g.key === selected) || filtered[0] || null;
  const customerRow = current && customers.find(c => (phoneKey(c.phone) && phoneKey(c.phone) === phoneKey(current.phone)) || (norm(c.email) && norm(c.email) === norm(current.email)));
  useEffect(() => { setPref({ preferred_cottage: customerRow?.preferred_cottage || "", special_requests: customerRow?.special_requests || "", marketing_consent: Boolean(customerRow?.marketing_consent) }); }, [customerRow?.id, customerRow?.preferred_cottage, customerRow?.special_requests, customerRow?.marketing_consent]);
  async function stayAction(b, action) { if (!window.confirm(`${action === "check-in" ? "Check in" : "Check out"} ${current?.name} for booking ${b.ref || b.id}?`)) return; setBusy(true); try { await api(`/admin/bookings/${encodeURIComponent(b.id)}/${action}`, { method: "POST" }, token); await refresh(); await reloadExtra(); onNotice("Guest stay updated successfully."); } catch (e) { onError(e.message); } finally { setBusy(false); } }
  async function addCustomer(e) { e.preventDefault(); setBusy(true); try { await api("/admin/customers", { method: "POST", body: JSON.stringify(newCustomer) }, token); await reloadExtra(); setAddOpen(false); setNewCustomer({ name: "", phone: "", email: "" }); onNotice("Customer added."); } catch (e) { onError(e.message); } finally { setBusy(false); } }
  async function ensureCustomer() { if (customerRow) return customerRow.id; const r = await api("/admin/customers", { method: "POST", body: JSON.stringify({ name: current.name, phone: current.phone, email: current.email }) }, token); return r.id; }
  async function saveNote(e) { e.preventDefault(); if (!noteText.trim()) return; setBusy(true); try { const id = await ensureCustomer(); await api("/admin/customer-notes", { method: "POST", body: JSON.stringify({ customer_id: id, note: noteText.trim() }) }, token); setNoteText(""); await reloadExtra(); onNotice("Customer note saved."); } catch (e) { onError(e.message); } finally { setBusy(false); } }
  async function savePreferences(e) { e.preventDefault(); setBusy(true); try { const id = await ensureCustomer(); await api(`/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(pref) }, token); await reloadExtra(); onNotice("Preferences saved."); } catch (e) { onError(e.message); } finally { setBusy(false); } }
  const csv = () => { const safe = v => { const s = String(v ?? ""); return '"' + (/^[\s]*[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"'; }; const lines = [["Name", "Phone", "Email", "Bookings", "Completed stays", "Cancellations", "Verified spending"], ...filtered.map(g => [g.name, g.phone, g.email, g.bookings.length, g.completed, g.cancellations, g.total])].map(r => r.map(safe).join(",")).join("\r\n"); const u = URL.createObjectURL(new Blob(["\ufeff" + lines], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download = "ewalel-customers.csv"; a.click(); URL.revokeObjectURL(u); };
  const card = { background: "white", border: "1px solid #dce6e4", borderRadius: 16, padding: 20 };
  const stat = (title, value, tone) => <div key={title} style={{ padding: "16px 19px", borderRadius: 13, background: tone[0], border: `1px solid ${tone[1]}`, borderLeft: `4px solid ${tone[2]}` }}><div style={{ fontSize: 12, color: tone[2], marginBottom: 5 }}>{title}</div><b style={{ fontSize: 23, color: "#102f35" }}>{value}</b></div>;
  const T = { green: ["#e9f7ef", "#c0e8cc", "#087444"], blue: ["#e9f1ff", "#bed5ff", "#235ea5"], purple: ["#f3eaff", "#dfc8fc", "#7641b2"], red: ["#ffeded", "#ffc9c9", "#b94040"], gold: ["#fff5e2", "#ffe0a2", "#a96a06"] };
  return <div className="ew-crm" style={{ width: "100%", maxWidth: 1720, margin: "0 auto", padding: "6px 0 25px", color: "#102d35" }}>
    <style>{`main:has(> .breadcrumb):has(.ew-crm){max-width:1740px!important;width:calc(100% - 40px)!important;margin-left:auto!important;margin-right:auto!important;padding-left:0!important;padding-right:0!important}@media(max-width:700px){main:has(> .breadcrumb):has(.ew-crm){width:calc(100% - 24px)!important}}.ew-crm *{box-sizing:border-box}.ew-crm button,.ew-crm input,.ew-crm select,.ew-crm textarea{font:inherit}.ew-crm button{cursor:pointer}.ew-crm button:disabled{opacity:.5;cursor:not-allowed}.ew-crm .crm-btn{border:1px solid #cbd8db;border-radius:10px;background:#fff;color:#173a40;padding:10px 15px;font-weight:600}.ew-crm .crm-primary{background:#103f43;color:#fff;border-color:#103f43}.ew-crm .crm-btn:hover:not(:disabled){filter:brightness(.94)}.ew-crm .crm-input{width:100%;padding:11px 13px;border:1px solid #cbd9db;border-radius:9px;background:#fff;color:#14383e}.ew-crm .crm-tabs{display:flex;gap:10px;flex-wrap:wrap}.ew-crm .crm-tabs button{flex:1;border:1px solid #d8e2e4;background:#fff;border-radius:26px;padding:11px;white-space:nowrap}.ew-crm .crm-tabs button.active{background:#104348;color:#fff}.ew-crm .crm-person{width:100%;text-align:left;border:1px solid #d9e5e2;border-radius:13px;padding:12px;background:#fff;margin:6px 0;display:flex;align-items:center;gap:12px}.ew-crm .crm-person.active{background:#e6f4ee;border-color:#64b6a3}.ew-crm .crm-avatar{width:50px;height:50px;border-radius:50%;background:#dceee4;display:grid;place-items:center;font-size:21px;color:#126047;flex-shrink:0}.ew-crm .crm-layout{display:grid;grid-template-columns:minmax(300px, 30%) minmax(0, 1fr);gap:20px;align-items:start}.ew-crm .crm-layout>aside,.ew-crm .crm-layout>main{min-width:0}.ew-crm .crm-layout>main{min-height:0}.ew-crm .crm-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.ew-crm .crm-actions{display:flex;gap:8px;flex-wrap:wrap}.ew-crm .crm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}.ew-crm .crm-grid>section,.ew-crm .crm-grid>div{min-width:0}.ew-crm .crm-detail{padding:11px 0;border-bottom:1px solid #e5eceb;display:flex;justify-content:space-between;gap:15px}.ew-crm .crm-muted{color:#668086}.ew-crm .crm-mini{font-size:12px}.ew-crm .crm-booking{padding:15px;border:1px solid #d9e5e2;border-radius:12px;margin:12px 0}.ew-crm .crm-chip{border-radius:20px;padding:5px 9px;font-size:11px;background:#e6f3ec;color:#146340;font-weight:700}@media(max-width:1180px){.ew-crm .crm-grid{grid-template-columns:1fr}}@media(max-width:1050px){.ew-crm .crm-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:750px){.ew-crm .crm-layout,.ew-crm .crm-grid{grid-template-columns:1fr}.ew-crm .crm-kpis{grid-template-columns:repeat(2,1fr)}.ew-crm .crm-head{flex-direction:column;align-items:flex-start!important}}`}</style>
    <div style={{ ...card, marginBottom: 18 }}>
      <div className="crm-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 15, marginBottom: 24 }}><div><div style={{ fontSize: 12, letterSpacing: 2, color: "#b96a2d", fontWeight: 700 }}>EW A L E L  /  CUSTOMER RELATIONSHIPS</div><h1 style={{ fontSize: 30, margin: "8px 0 3px" }}>Customer Retention</h1><div className="crm-muted">Manage guests, track bookings and payments, and build lasting customer relationships.</div></div><div className="crm-actions"><ManualGuestRegistration cottages={cottages} token={token} onSaved={async () => { await refresh(); await reloadExtra(); onNotice("Walk-in booking saved."); }} onError={onError} /><button className="crm-btn" onClick={() => setAddOpen(true)}>＋ Add Contact</button><button className="crm-btn" onClick={csv}>↓ Export (CSV)</button><button className="crm-btn" onClick={() => setInsights(v => !v)}>▥ Retention Insights</button></div></div>
      <div className="crm-kpis">{stat("Total customers", profiles.length, T.green)}{stat("Total bookings", bookings.length, T.blue)}{stat("Completed stays", bookings.filter(b => stayStatus(b) === "checked_out").length, T.green)}{stat("Returning guests", `${profiles.filter(g => g.bookings.length >= 2).length} (${profiles.length ? Math.round(100 * profiles.filter(g => g.bookings.length >= 2).length / profiles.length) : 0}%)`, T.purple)}{stat("Cancellations", bookings.filter(b => b.status === "cancelled").length, T.red)}{stat("Verified spending", fmt(profiles.reduce((n, g) => n + g.total, 0)), T.gold)}</div>
      {insights && <p style={{ marginTop: 16, color: "#385c62" }}>Returning customer rate is based on multiple bookings linked by phone or email. Spending counts completed payments only. Use booking history to identify guests eligible for a consent-based follow-up.</p>}
    </div>
    <div className="crm-layout"><aside style={card}>
      <input className="crm-input" aria-label="Search customers" placeholder="Search name, phone, email or booking" value={query} onChange={e => setQuery(e.target.value)} />
      <div style={{
        display: "grid",
        // gridTemplateColumns: "360px minmax(0, 1fr)",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "20px",
        alignItems: "start",
        width: "100%",
        maxWidth: "1600px",
        margin: "0 auto",
      }}><select className="crm-input" value={segment} onChange={e => setSegment(e.target.value)}><option value="all">All customers</option><option value="returning">Returning</option><option value="new">New</option><option value="inactive">Inactive</option><option value="in-house">In-house</option></select><select className="crm-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All status</option>{["awaiting_payment", "payment_submitted", "awaiting_confirmation", "confirmed", "checked_in", "checked_out", "cancelled"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select><select className="crm-input" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">All time</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">12 months</option></select></div>
      <div style={{ maxHeight: 700, overflowY: "auto" }}>{filtered.map(g => <button key={g.key} className={`crm-person ${current?.key === g.key ? "active" : ""}`} onClick={() => { setSelected(g.key); setTab("Overview"); }}><span className="crm-avatar">{g.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}</span><span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block" }}>{g.name}</strong><small className="crm-muted">{g.phone || g.email || "No contact details"}</small><small style={{ display: "block", marginTop: 5 }}>{g.bookings.length} booking(s) · {fmt(g.total)}</small></span><span className="crm-chip">{g.inactive ? "Inactive" : g.segment}</span></button>)}{!filtered.length && <p className="crm-muted">No matching customers.</p>}</div>
    </aside>
      <main style={card}>{!current ? <p className="crm-muted">Select a customer to view their profile.</p> : <>
        <div className="crm-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, marginBottom: 18 }}><div style={{ display: "flex", alignItems: "center", gap: 15 }}><div className="crm-avatar" style={{ width: 70, height: 70, fontSize: 27 }}>{current.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}</div><div><h2 style={{ fontSize: 24, margin: "0 0 6px" }}>{current.name} <span className="crm-chip">{current.segment} Customer</span></h2><div className="crm-muted crm-mini">{current.phone || "No phone"} · {current.email || "No email"}</div></div></div><div className="crm-actions">{current.phone && <a className="crm-btn" href={`tel:${current.phone}`}>☎ Call</a>}{current.email && <a className="crm-btn" href={`mailto:${current.email}`}>✉ Email</a>}<button className="crm-btn" onClick={() => { const msg = `Hello ${current.name}, thank you for choosing Ewalel Cottages. We would love to welcome you again.`; navigator.clipboard.writeText(msg).then(() => onNotice("Follow-up message copied; not sent.")).catch(() => onError("Clipboard unavailable")); }}>Follow Up</button></div></div>
        
<section
  className="crm-stay-management"
  style={{
    ...card,
    marginBottom: 18,
    background: "#f5faf8",
    padding: 18,
  }}
>
  <h3>Guest check-in & check-out</h3>

  {current.bookings
    .filter((b) => b.status !== "cancelled" && (b.status === "confirmed" || ["checked_in", "checked_out"].includes(stayStatus(b))))
    .map((b) => {
      const status = stayStatus(b);

      return (
        <div
          key={b.id}
          style={{
            padding: 15,
            borderBottom: "1px solid #dce7e2",
          }}
        >
          <strong>
            {b.cottage_name || b.unit_id} · #{b.ref || b.id}
          </strong>

          <p>
            {date(b.check_in)} – {date(b.check_out)}
          </p>

          <p>
            Stay status:{" "}
            <strong>{status.replaceAll("_", " ")}</strong>
          </p>

          {status === "checked_out" ? (
            <span className="crm-chip">Stay Completed</span>
          ) : (
            <button
              type="button"
              disabled={busy}
              className="crm-btn crm-primary"
              onClick={() =>
                stayAction(
                  b,
                  status === "checked_in"
                    ? "check-out"
                    : "check-in"
                )
              }
            >
              {busy
                ? "Saving…"
                : status === "checked_in"
                ? "Check Out Guest"
                : "Check In Guest"}
            </button>
          )}
        </div>
      );
    })}
</section>

        <div className="crm-tabs" style={{ marginBottom: 20 }}>{["Overview", "Bookings & Payments", "Activity & Notes", "Preferences", "Loyalty"].map(t => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
        {tab === "Overview" && <div className="crm-grid"><section style={card}><h3>Customer Summary</h3>{[["First booking", date(current.first)], ["Latest booking", date(current.last)], ["Total bookings", current.bookings.length], ["Completed stays", current.completed], ["Cancellations", current.cancellations], ["Verified spending", fmt(current.total)], ["Last stay", date(current.lastStay?.check_out)]].map(([a, b]) => <div className="crm-detail" key={a}><span>{a}</span><b>{b}</b></div>)}</section><div><section style={{ ...card, background: "#eaf8ef", marginBottom: 15 }}><h3>Next Stay</h3>{current.next ? <><strong>{date(current.next.check_in)} – {date(current.next.check_out)}</strong><p>{current.next.cottage_name || current.next.unit_id}</p><span className="crm-chip">{current.next.status.replaceAll("_", " ")}</span></> : <p>No upcoming confirmed stay</p>}</section><section style={{ ...card, background: "#edf5ff", marginBottom: 15 }}><h3>Retention Opportunity</h3><p>{current.bookings.length > 1 ? "Returning guest. Consider a personalized offer if marketing consent is recorded." : "New guest. Consider a post-stay feedback request with appropriate consent."}</p><button className="crm-btn" onClick={() => setTab("Loyalty")}>View loyalty</button></section><section style={card}><h3>Quick Actions</h3><div className="crm-actions"><button className="crm-btn" onClick={() => setTab("Activity & Notes")}>Add Note</button><button className="crm-btn" onClick={() => setTab("Bookings & Payments")}>View Stays</button><button className="crm-btn" onClick={() => setTab("Preferences")}>Preferences</button></div></section></div></div>}
        {tab === "Bookings & Payments" && <div><h3>Bookings & Payments</h3>{current.bookings.map(b => { const ps = payments.filter(p => String(p.booking_id) === String(b.id)); const rs = receipts.filter(r => String(r.booking_id) === String(b.id)); return <div className="crm-booking" key={b.id}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><b>#{b.ref || b.id} · {b.cottage_name || b.unit_id}</b><span className="crm-chip">{String(b.status).replaceAll("_", " ")}</span></div><p className="crm-muted crm-mini">Booked {date(b.created_at)} · Stay {date(b.check_in)} – {date(b.check_out)}</p><p><b>Booking total:</b> {fmt(b.total)}</p>{ps.map(p => <p key={p.id} style={{ fontSize: 13, margin: "5px 0" }}>Payment: {p.payment_method} · {fmt(p.amount)} · {p.status} · Ref: {p.transaction_reference || "—"}</p>)}{rs.map(r => <p key={r.trans_id} style={{ fontSize: 13, margin: "5px 0" }}>M-PESA receipt: <b>{r.receipt_number || "Not provided"}</b> · {r.status} · {date(r.received_at)}</p>)}{!ps.length && !rs.length && <p className="crm-muted crm-mini">No recorded payment or receipt.</p>}
{b.status !== "cancelled" &&
  (b.status === "confirmed" || ["checked_in", "checked_out"].includes(stayStatus(b))) &&
  (stayStatus(b) === "checked_out" ? (
    <span className="crm-chip">Stay Completed</span>
  ) : (
    <button
      type="button"
      disabled={busy}
      className="crm-btn crm-primary"
      onClick={() => stayAction(b, stayStatus(b) === "checked_in" ? "check-out" : "check-in")}
    >
      {busy ? "Saving…" : stayStatus(b) === "checked_in" ? "Check Out Guest" : "Check In Guest"}
    </button>
  ))}
{events.filter(e => String(e.booking_id) === String(b.id)).map(e => <p key={e.id} className="crm-muted crm-mini">{e.event_type.replaceAll("_", " ")}: {date(e.created_at)}</p>)}</div> })}{!current.bookings.length && <p>No bookings yet.</p>}</div>}
        {tab === "Activity & Notes" && <div><h3>Customer Activity & Notes</h3><form onSubmit={saveNote}><textarea className="crm-input" rows={3} placeholder="Add an internal customer service note" value={noteText} onChange={e => setNoteText(e.target.value)} required /><button className="crm-btn crm-primary" style={{ marginTop: 10 }} disabled={busy || !noteText.trim()}>Save Note</button></form><div style={{ marginTop: 18 }}>{notes.filter(n => customerRow && String(n.customer_id) === String(customerRow.id)).map(n => <div className="crm-booking" key={n.id}><p>{n.note}</p><small className="crm-muted">{date(n.created_at)}</small></div>)}{!customerRow && <p className="crm-muted">No saved customer notes.</p>}</div></div>}
        {tab === "Preferences" && <form onSubmit={savePreferences}><h3>Guest Preferences</h3><label>Preferred cottage<input className="crm-input" value={pref.preferred_cottage} onChange={e => setPref({ ...pref, preferred_cottage: e.target.value })} /></label><label style={{ display: "block", marginTop: 14 }}>Special requests<textarea className="crm-input" rows={4} value={pref.special_requests} onChange={e => setPref({ ...pref, special_requests: e.target.value })} /></label><label style={{ display: "flex", alignItems: "center", gap: 9, margin: "14px 0" }}><input type="checkbox" checked={pref.marketing_consent} onChange={e => setPref({ ...pref, marketing_consent: e.target.checked })} /> Marketing consent recorded</label><p className="crm-muted crm-mini">Only tick this when the guest has explicitly consented. This does not send messages.</p><button className="crm-btn crm-primary" disabled={busy}>Save Preferences</button></form>}
        {tab === "Loyalty" && <section style={card}><h3>Customer Loyalty</h3><div className="crm-grid">{stat("Total bookings", current.bookings.length, T.blue)}{stat("Verified spending", fmt(current.total), T.gold)}</div><p style={{ marginTop: 20 }}>Customer segment: <b>{current.segment}</b></p><p className="crm-muted">Loyalty information is calculated from actual reservations and completed payments. No discount or loyalty points have been issued.</p><p>Marketing consent: <b>{customerRow?.marketing_consent ? "Recorded" : "Not recorded"}</b></p></section>}
      </>}</main></div>
    {addOpen && <div role="dialog" aria-modal="true" aria-label="Add customer" style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 9999, display: "grid", placeItems: "center", padding: 15 }}><form onSubmit={addCustomer} style={{ ...card, width: "min(100%,480px)", boxShadow: "0 20px 60px #0004" }}><h2>Add Customer</h2><p className="crm-muted">Create a customer contact record without creating a booking.</p>{[["name", "Full name"], ["phone", "Phone"], ["email", "Email"]].map(([k, l]) => <label key={k} style={{ display: "block", marginBottom: 12 }}>{l}<input className="crm-input" type={k === "email" ? "email" : "text"} required={k === "name"} value={newCustomer[k]} onChange={e => setNewCustomer({ ...newCustomer, [k]: e.target.value })} /></label>)}<div className="crm-actions"><button type="submit" disabled={busy} className="crm-btn crm-primary">Save Customer</button><button type="button" className="crm-btn" onClick={() => setAddOpen(false)}>Cancel</button></div></form></div>}
    <p className="crm-muted crm-mini" style={{ marginTop: 15 }}>Customer profiles are grouped by phone or email, never name alone. Payments and M-PESA receipts reflect database records; M-PESA verification remains a separate administrator process. Store and export guest information securely.</p>
  </div>;
}

function ReservationsPanel({ sub, cottages = [], bookings, payments = [], token, refresh, setError, setNotice, openConfirmation }) {
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
  const statusColor = status =>
    bookingStatusColors[statusLabel(status)] || bookingStatusColors["Total bookings"];
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
    <CustomerRetention
      cottages={cottages}
      bookings={rows}
      payments={payments}
      token={token}
      onError={setError}
      onNotice={setNotice}
      refresh={refresh}
    />
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
        <span style={{
          ...reservationStyle.pill,
          background: statusColor(b.status).bg,
          color: statusColor(b.status).text,
          border: `1px solid ${statusColor(b.status).border}`,
          whiteSpace: "nowrap"
        }}>{statusLabel(b.status)}</span>
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
