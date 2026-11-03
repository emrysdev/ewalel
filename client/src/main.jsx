
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
  X
} from "lucide-react";

import "./style.css";
import Guest from "./Guest.jsx";
import CottageManagement from "./components/CottageManagement.jsx";

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

const tabs = [
  ["Overview", LayoutDashboard],
  ["Reservations", CalendarDays],
  ["Cottages", House],
  ["Finance", Wallet],
  ["Reports", FileBarChart]
];

const sections = {
  Overview: ["Dashboard", "Operations"],
  Reservations: ["Bookings", "Guests"],
  Cottages: ["Manage cottages", "Maintenance"],
  Finance: ["Revenue & payments"],
  Reports: ["Excel reports"]
};

const money = (n) =>
  "KES " + Number(n || 0).toLocaleString("en-KE");

async function api(path, options = {}, token) {
  const response = await fetch(BASE + "/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function App() {
  const [token, setToken] = useState(
    sessionStorage.getItem("ewalel_token") || ""
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    methods: []
  });

  const [filter, setFilter] = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const [form, setForm] = useState({
    cottage_id: "",
    task: "",
    scheduled_date: "",
    assigned_to: "",
    estimated_cost: "",
    notes: ""
  });

  const [pform, setPform] = useState({
    booking_id: "",
    method: "mpesa",
    amount: "",
    reference: "",
    status: "pending"
  });

  // LOAD DATA FROM MYSQL
  const refresh = useCallback(async () => {
    if (!token) return;

    try {
      const [c, m, b, p, f] = await Promise.all([
        api("/admin/cottages", {}, token),
        api("/admin/maintenance", {}, token),
        api("/admin/bookings", {}, token),
        api("/admin/payments", {}, token),
        api("/admin/finance", {}, token)
      ]);

      setCottages(c);
      setRecords(m);
      setBookings(b);
      setPayments(p);
      setFinance(f);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, 15000);

    return () => clearInterval(interval);
  }, [refresh]);

  // SHARED ACTION HANDLER
  async function run(fn) {
    try {
      setError("");
      setNotice("");

      await fn();
      await refresh();

      setNotice("Saved successfully");
    } catch (err) {
      setError(err.message);
    }
  }

  // ADMIN LOGIN
  async function login(e) {
    e.preventDefault();

    try {
      setError("");

      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password
        })
      });

      sessionStorage.setItem("ewalel_token", result.token);

      setToken(result.token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    sessionStorage.removeItem("ewalel_token");

    setToken("");
    setError("");
    setNotice("");
  }

  // MAINTENANCE CALCULATIONS
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

  if (!token) {
    return (
      <main className="login">
        <section className="panel">
          <div className="eyebrow">
            EWALEL COTTAGES
          </div>

          <h1>Admin sign in</h1>

          <p>
            Access the MySQL-backed management dashboard.
          </p>

          <form onSubmit={login}>
            <div className="fields">
              <label className="wide">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="wide">
                Password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </div>

            <button className="primary" type="submit">
              Sign in
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

  return (
    <>
      {/* HEADER */}
      <header>
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon">
              <House size={21} />
            </span>

            <div>
              <strong>Ewalel Admin</strong>
              <small>COTTAGES MANAGEMENT</small>
            </div>
          </div>

          <div className="header-right">
            <span className="demo">
              MySQL connected dashboard
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
              }}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </nav>
      </header>

      {/* MAIN DASHBOARD */}
      <main>
        <div className="breadcrumb">
          ADMINISTRATION / {tab.toUpperCase()} / {sub.toUpperCase()}
        </div>

        <div className="subnav">
          {sections[tab].map((section) => (
            <button
              key={section}
              className={sub === section ? "active" : ""}
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

        {/* COTTAGE MANAGEMENT */}
        {tab === "Cottages" && sub === "Manage cottages" ? (
          <CottageManagement
            cottages={cottages}
            token={token}
            onRefresh={refresh}
          />

        ) : tab === "Cottages" && sub === "Maintenance" ? (
          <>
            {/* MAINTENANCE PAGE */}
            <div className="page-title">
              <div>
                <div className="eyebrow">
                  PROPERTY OPERATIONS
                </div>

                <h1>Maintenance management</h1>

                <p>
                  Schedule cottage maintenance, track work
                  and review previous service history.
                </p>
              </div>

              <button
                className="primary"
                onClick={() => setFormOpen(!formOpen)}
              >
                <Plus size={18} />
                Add maintenance
              </button>
            </div>

            {/* MAINTENANCE STATISTICS */}
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

            {/* ADD MAINTENANCE FORM */}
            {formOpen && (
              <section className="panel form-panel">
                <div className="panel-title">
                  <h2>Schedule maintenance</h2>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setFormOpen(false)}
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
                          body: JSON.stringify(form)
                        },
                        token
                      );

                      setFormOpen(false);

                      setForm({
                        cottage_id: "",
                        task: "",
                        scheduled_date: "",
                        assigned_to: "",
                        estimated_cost: "",
                        notes: ""
                      });
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
                            cottage_id: e.target.value
                          })
                        }
                      >
                        <option value="">
                          Choose cottage
                        </option>

                        {cottages.map((cottage) => (
                          <option
                            key={cottage.id}
                            value={cottage.id}
                          >
                            {cottage.name}
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
                            scheduled_date: e.target.value
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
                            task: e.target.value
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
                            assigned_to: e.target.value
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
                            estimated_cost: e.target.value
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
                            notes: e.target.value
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

            {/* MAINTENANCE RECORDS */}
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Maintenance records</h2>
                  <p>
                    Scheduled work and previous maintenance
                  </p>
                </div>

                <div className="filters">
                  {["All", "Scheduled", "History"].map(
                    (item) => (
                      <button
                        key={item}
                        className={
                          filter === item ? "selected" : ""
                        }
                        onClick={() => setFilter(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="records">
                {visibleMaintenance.length === 0 ? (
                  <p className="empty">
                    No records yet. Add a maintenance task above.
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
                              <CalendarDays size={14} />
                              {String(
                                record.scheduled_date
                              ).slice(0, 10)}
                            </span>
                          </div>
                        </div>

                        <span
                          className={
                            "status " +
                            (
                              record.status === "completed"
                                ? "complete"
                                : "scheduled"
                            )
                          }
                        >
                          {record.status.replace("_", " ")}
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
                            {record.assigned_to || "Not assigned"}
                          </p>

                          <p>
                            <b>Notes:</b>{" "}
                            {record.notes || "None"}
                          </p>

                          {record.status !== "completed" &&
                            record.status !== "cancelled" && (
                              <button
                                className="primary small"
                                onClick={() => {
                                  const entered = window.prompt(
                                    "Actual cost in KES",
                                    String(
                                      record.estimated_cost ?? 0
                                    )
                                  );

                                  if (entered === null) return;

                                  const actualCost = Number(entered);

                                  if (
                                    !Number.isFinite(actualCost) ||
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
                                          status: "completed",
                                          actual_cost: actualCost
                                        })
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
          /* RESERVATIONS PAGE */
          <section className="panel">
            <h1>{sub}</h1>
            <p>Booking records from MySQL.</p>

            <div className="records">
              {bookings.map((booking) => (
                <article
                  className="record"
                  key={booking.id}
                >
                  <h3>
                    #{booking.id} — {booking.guest_name}
                  </h3>

                  <p>
                    {booking.cottage_name}
                    {" · "}
                    {String(booking.check_in).slice(0, 10)}
                    {" to "}
                    {String(booking.check_out).slice(0, 10)}
                    {" · "}
                    {money(booking.total_amount)}
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
                            "/admin/bookings/" + booking.id,
                            {
                              method: "PATCH",
                              body: JSON.stringify({
                                status: e.target.value
                              })
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
                        "checked_out"
                      ].map((status) => (
                        <option key={status} value={status}>
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

        ) : tab === "Finance" || tab === "Overview" ? (
          <>
            {/* FINANCIAL OVERVIEW */}
            <div className="page-title">
              <div>
                <h1>
                  {tab === "Finance"
                    ? "Revenue & payments"
                    : "Business overview"}
                </h1>

                <p>
                  Automatically refreshed from MySQL
                  every 15 seconds.
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
                  <strong>{bookings.length}</strong>
                </div>
              </article>
            </div>

            {/* REVENUE BY PAYMENT METHOD */}
            <section className="panel">
              <h2>Revenue by payment method</h2>

              {["mpesa", "card", "cash"].map((method) => {
                const amount = Number(
                  finance.methods.find(
                    (item) => item.method === method
                  )?.amount || 0
                );

                const percentage = finance.revenue
                  ? Math.min(
                      100,
                      amount / finance.revenue * 100
                    )
                  : 0;

                return (
                  <div
                    className="payment-bar"
                    key={method}
                  >
                    <div>
                      {method.toUpperCase()}
                      {" "}
                      <strong>{money(amount)}</strong>
                    </div>

                    <div className="track">
                      <div
                        style={{
                          width: percentage + "%"
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </section>

            {tab === "Finance" && (
              <>
                {/* RECORD PAYMENT */}
                <section className="panel">
                  <h2>
                    Record verified payment or pending payment
                  </h2>

                  <p>
                    Only record completed payments after
                    independently verifying a genuine receipt.
                    No live gateway is included.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();

                      run(async () => {
                        await api(
                          "/admin/payments",
                          {
                            method: "POST",
                            body: JSON.stringify(pform)
                          },
                          token
                        );

                        setPform({
                          booking_id: "",
                          method: "mpesa",
                          amount: "",
                          reference: "",
                          status: "pending"
                        });
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
                              booking_id: e.target.value
                            })
                          }
                        >
                          <option value="">
                            Select booking
                          </option>

                          {bookings.map((booking) => (
                            <option
                              key={booking.id}
                              value={booking.id}
                            >
                              #{booking.id} — {booking.guest_name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Method
                        <select
                          value={pform.method}
                          onChange={(e) =>
                            setPform({
                              ...pform,
                              method: e.target.value
                            })
                          }
                        >
                          {["mpesa", "card", "cash"].map(
                            (method) => (
                              <option
                                key={method}
                                value={method}
                              >
                                {method}
                              </option>
                            )
                          )}
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
                              amount: e.target.value
                            })
                          }
                        />
                      </label>

                      <label>
                        Reference
                        <input
                          value={pform.reference}
                          onChange={(e) =>
                            setPform({
                              ...pform,
                              reference: e.target.value
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
                              status: e.target.value
                            })
                          }
                        >
                          <option value="pending">
                            pending
                          </option>

                          <option value="completed">
                            completed — verified
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

                {/* PAYMENT REGISTER */}
                <section className="panel">
                  <h2>Payment acknowledgement register</h2>

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
                      {payment.reference || "No reference"}
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
          /* REPORTS PAGE */
          <section className="panel">
            <h1>Reports</h1>

            <p>
              View live operational totals in Overview
              and Finance. Excel exports are planned
              for a later release.
            </p>
          </section>
        )}
      </main>
    </>
  );
}

// RENDER ADMIN OR GUEST WEBSITE
createRoot(document.getElementById("root")).render(
  window.location.pathname.startsWith("/admin")
    ? <App />
    : <Guest />
);
