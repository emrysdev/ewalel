
import React, { useState, useEffect, useCallback } from "react";
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
  Reservations: ["Bookings", "Guests"],
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

  const [tab, setTab] = useState("Cottages");
  const [sub, setSub] = useState("Manage cottages");
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
          <section className="panel">
            <h1>{sub}</h1>

            <p>
              Guest reservations stored in MySQL.
            </p>

            <div className="records">
              {bookings.map((booking) => (
                <article
                  className="record"
                  key={booking.id}
                >
                  <h3>
                    #{booking.id} —{" "}
                    {booking.guest_name}
                  </h3>

                  <p>
                    {booking.cottage_name}
                    {" · "}
                    {String(
                      booking.check_in
                    ).slice(0, 10)}
                    {" to "}
                    {String(
                      booking.check_out
                    ).slice(0, 10)}
                    {" · "}
                    {money(
                      booking.total_amount
                    )}
                  </p>

                  <div className="actions">
                    <span className="status scheduled">
                      {booking.status}
                    </span>

                    <select
                      value={booking.status}
                      onChange={(e) =>
                        run(() =>
                          api(
                            "/admin/bookings/" +
                              booking.id,
                            {
                              method: "PATCH",
                              body: JSON.stringify({
                                status:
                                  e.target.value,
                              }),
                            },
                            token
                          )
                        )
                      }
                    >
                      {[
                        "pending",
                        "confirmed",
                        "cancelled",
                        "checked_in",
                        "checked_out",
                      ].map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}

              {bookings.length === 0 && (
                <p>No bookings recorded.</p>
              )}
            </div>
          </section>

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
// ROUTE PUBLIC WEBSITE AND ADMIN DASHBOARD
// =====================================================

createRoot(
  document.getElementById("root")
).render(
  window.location.pathname.startsWith("/admin")
    ? <App />
    : <Guest />
);
