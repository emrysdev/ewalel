
// Scheduled booking times are in Kenya local time. Missing legacy values use standard times.
function formatScheduledTime(value, fallback) {
  const raw = String(value || fallback).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return formatScheduledTime(fallback, fallback);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return formatScheduledTime(fallback, fallback);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

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
  Search, Eye, CreditCard, TrendingUp, Download, ArrowRight, CalendarCheck, CircleCheck, Ban, RefreshCw, BarChart3, Users, Filter,
} from "lucide-react";

import "./style.css";
import "./analytics-dashboard.css";
import "./ewalel-sidebar.css";
import AnalyticsDashboard from "./components/AnalyticsDashboard.jsx";
import FacilitiesPanel from "./components/FacilitiesPanel.jsx";
import ReportsSuite from "./components/ReportsSuite.jsx";
import Guest from "./Guest.jsx";
import CottageManagement from "./components/CottageManagement.jsx";
import ManualGuestRegistration from "./components/ManualGuestRegistration.jsx";

// =====================================================
// API CONFIGURATION
// =====================================================

const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

// Configure VITE_API_URL for a separate Railway backend, or leave it unset
// when the API and frontend are served from the same origin.
const BASE = (
  import.meta.env.VITE_API_URL ||
  (isLocal ? "http://localhost:4000" : window.location.origin)
).replace(/\/$/, "");

const IMAGE_BASE = (
  import.meta.env.VITE_IMAGE_BASE_URL ||
  BASE
).replace(/\/$/, "");

function getImageUrl(photoUrl) {
  if (!photoUrl) return "";

  const value = String(photoUrl).trim();
  if (/^https?:\/\//i.test(value)) return value;

  return `${IMAGE_BASE}/${value.replace(/^\/+/, "")}`;
}

async function api(path, options = {}, token) {
  const { headers: customHeaders, ...requestOptions } = options;
  const isFormData = typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
  const headers = {
    ...(!isFormData && requestOptions.body != null ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  };

  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      ...requestOptions,
      headers,
    });
  } catch (error) {
    console.error("Ewalel API connection error:", error);
    throw new Error("Unable to connect to the Ewalel server. Check the API URL and Railway deployment.");
  }

  const raw = await response.text();
  let data = {};
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { data = { message: response.ok ? "Unexpected server response." : `Request failed (HTTP ${response.status})` }; }
  }
  if (!response.ok) {
    console.error("Ewalel API error:", { endpoint: path, status: response.status, response: data });
    throw new Error(data?.error || data?.message || `Request failed (HTTP ${response.status})`);
  }
  return data;
}

const money = (value) =>
  "KES " + Number(value || 0).toLocaleString("en-KE");

const tabs = [
  ["Dashboard", LayoutDashboard],
  ["Reservations", CalendarDays],
  ["Cottages", House],
  ["Guests", Users],
  ["Finance", Wallet],
  ["Reports & Analytics", FileBarChart],
  ["Facilities & Amenities", House],
  ["Maintenance", Wrench],
  ["Settings", Wrench],
];

const sections = {
  Dashboard: ["Dashboard"],
  Reservations: ["Bookings", "Booking Confirmation"],
  Cottages: ["Manage cottages"],
  Guests: ["Guests"],
  Finance: ["Revenue & payments"],
  "Reports & Analytics": ["Analytics & exports"],
  "Facilities & Amenities": ["Facilities"],
  Maintenance: ["Maintenance"],
  Settings: ["Settings"],
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

  const [tab, setTab] = useState("Dashboard");
  const [sub, setSub] = useState("Dashboard");
  const [mobile, setMobile] = useState(false);
  const [cottagesExpanded, setCottagesExpanded] = useState(false);

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
        api("/cottages"),
        api("/admin/maintenance", {}, token),
        api("/admin/bookings", {}, token),
        api("/admin/payments", {}, token),
        api("/admin/finance", {}, token),
      ]);

      setCottages(Array.isArray(c) ? c : []);
      setRecords(Array.isArray(m) ? m : []);
      setBookings(Array.isArray(b) ? b : []);
      setPayments(Array.isArray(p) ? p : []);
      setFinance(f && typeof f === "object" ? f : { revenue: 0, outstanding: 0, methods: [] });
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
    <div className="ew-suite-shell">
      <aside className={`ew-suite-sidebar ${mobile ? "is-open" : ""}`} aria-label="Main administration navigation">
        <div className="ew-suite-logo">
          <img src="/images/ewalel-logo.png" alt="Ewalel Cottages" />
          <span>EWALEL<small>COTTAGES</small></span>
        </div>
        <div className="ew-suite-side-group ew-modern-nav">
          <div className="ew-suite-side-heading">ADMINISTRATION</div>
          {tabs.map(([name, Icon]) => (
            <div key={name} className="ew-nav-item">
              <button type="button" className={`ew-nav-link ${tab === name ? "is-selected" : ""}`}
                aria-current={tab === name ? "page" : undefined}
                aria-expanded={name === "Cottages" ? cottagesExpanded : undefined}
                onClick={() => {
                  if (name === "Cottages") setCottagesExpanded(v => !v);
                  setTab(name); setSub(sections[name][0]); setMobile(false);
                  setFormOpen(false); setNotice(""); setError("");
                }}>
                <Icon size={19} strokeWidth={1.9} /> <span>{name}</span>
                {/* {name === "Cottages" && <ChevronDown size={16} className={`ew-nav-chevron ${cottagesExpanded ? "expanded" : ""}`} />} */}
              </button>

            </div>
          ))}
        </div>
        <div className="ew-suite-side-foot">LAKE ELEMENTAITA · KENYA</div>
      </aside>
      <div className="ew-suite-workspace">
        <header>
          <div className="header-inner">
            <div className="brand">
              <div>
                <strong>Admin</strong>

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

          {tab === "Dashboard" ? (
            <AnalyticsDashboard
              bookings={bookings}
              payments={payments}
              cottages={cottages}
              finance={finance}
              onRefresh={refresh}
              onNavigate={(nextTab, nextSub) => {
                setTab(nextTab);
                setSub(nextTab === "Maintenance" ? "Maintenance" : (nextSub || sections[nextTab]?.[0] || "Dashboard"));
                setMobile(false);
              }}
            />
          ) : tab === "Facilities & Amenities" ? (
            <FacilitiesPanel />
          ) : tab === "Cottages" &&
            sub === "Manage cottages" ? (
            <CottageManagement
              cottages={cottages}
              token={token}
              onRefresh={refresh}
              bookings={bookings}
              maintenance={records}
            />

          ) : tab === "Maintenance" ? (
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

          ) : tab === "Reservations" || tab === "Guests" ? (
            <ReservationsPanel
              sub={tab === "Guests" ? "Guests" : sub}
              cottages={cottages}
              bookings={bookings}
              payments={payments}
              token={token}
              refresh={refresh}
              setError={setError}
              setNotice={setNotice}
              openConfirmation={() => setSub("Booking Confirmation")}
            />

          ) : tab === "Finance" ? (
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

          ) : tab === "Settings" ? (
            <section className="panel">
              <h1>Settings</h1>
              <p>Administrator configuration is managed through your existing backend and Railway environment variables. No credentials are displayed here.</p>
            </section>
          ) : (
            <ReportsSuite bookings={bookings} payments={payments} cottages={cottages} maintenance={records} />
          )}
        </main>
      </div>
      {mobile && <button className="ew-suite-scrim" aria-label="Close sidebar" onClick={() => setMobile(false)} />}
    </div>
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



// Outstanding balance collection: server validates amount and confirms booking atomically.
function GuestBalancePayment({ booking, payments, receipts, token, refresh, reloadExtra, onError, onNotice }) {
  const verified = payments.filter(p => String(p.booking_id) === String(booking.id) && p.status === "completed")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const total = Number(booking.total ?? booking.total_amount ?? 0);
  const balance = Math.max(0, Math.round((total - verified) * 100) / 100);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [evidence, setEvidence] = useState("");
  const [attested, setAttested] = useState(false);
  const [saving, setSaving] = useState(false);
  const money = n => `KES ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
  const pending = receipts.find(r => String(r.booking_id) === String(booking.id) && r.status === "pending");
  const pendingReceipt = String(pending?.receipt_number || "").toUpperCase();
  const validMpesaReceipt = /^[A-Z0-9]{8,20}$/.test(reference.trim().toUpperCase());
  if (booking.status === "cancelled") return null;
  async function submit(e) {
    e.preventDefault();
    const paid = Number(amount);
    if (!Number.isSafeInteger(paid) || paid <= 0 || paid > balance) {
      onError("Enter a positive whole-KES amount not exceeding the outstanding balance."); return;
    }
    if (method === "card") { onError("Card payments must be confirmed by your payment processor."); return; }
    if (method === "mpesa") {
      if (paid !== balance) { onError("The existing M-PESA verification endpoint requires the verified amount to equal the full outstanding balance."); return; }
      if (!pending && !validMpesaReceipt) { onError("Enter a valid M-PESA receipt number (8–20 letters/numbers)."); return; }
      if (pending && (evidence.trim().length < 5 || !attested)) { onError("Enter independent Safaricom verification evidence and confirm that you checked it."); return; }
    } else if (!reference.trim()) { onError("Enter the cash receipt/reference number."); return; }
    const action = method === "mpesa" ? pending ? "Verify M-PESA payment" : "Submit M-PESA receipt for verification" : "Record cash payment";
    if (!window.confirm(`${action}: ${money(paid)} for booking ${booking.ref || booking.id}?`)) return;
    setSaving(true);
    try {
      let message;
      if (method === "mpesa" && pending) {
        await api("/admin/mpesa/verify", {
          method: "POST", body: JSON.stringify({
            receipt_number: pendingReceipt, verified_amount: paid, verification_reference: evidence.trim()
          })
        }, token);
        message = "M-PESA payment verified and booking confirmed. Check In Guest is now available.";
      } else if (method === "mpesa") {
        await api("/admin/mpesa/record", {
          method: "POST", body: JSON.stringify({
            booking_id: booking.id, receipt_number: reference.trim().toUpperCase()
          })
        }, token);
        message = "M-PESA receipt recorded as pending. Verify it against Safaricom, then confirm it here before check-in.";
      } else {
        const result = await api(`/admin/bookings/${encodeURIComponent(booking.id)}/settle-balance`, {
          method: "POST", body: JSON.stringify({ amount: paid, method: "cash", reference: reference.trim(), cash_verified: true })
        }, token);
        message = result?.can_check_in ? "Balance paid and booking confirmed. Check In Guest is now available." : "Part payment recorded. Outstanding balance updated.";
      }
      setAmount(""); setReference(""); setEvidence(""); setAttested(false);
      await refresh(); await reloadExtra();
      onNotice(message);
    } catch (err) { onError(err.message); } finally { setSaving(false); }
  }
  return <div style={{ marginTop: 14, padding: 16, border: "1px solid #c8dfd8", borderRadius: 12, background: "#fff" }}>
    <h4 style={{ margin: "0 0 12px" }}>Guest Payment Management</h4>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 14 }}>
      <div><small>Booking total</small><div><strong>{money(total)}</strong></div></div>
      <div><small>Verified payments</small><div><strong>{money(verified)}</strong></div></div>
      <div><small>Outstanding balance</small><div><strong>{money(balance)}</strong></div></div>
    </div>
    {balance <= 0 ? <p style={{ color: "#087444", margin: 0 }}>Balance fully paid{booking.status === "confirmed" ? " · Booking confirmed" : " · Awaiting booking reconciliation"}.</p> :
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <label>Payment received (KES)<input className="crm-input" type="number" step="1" min="1" max={balance} required value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(balance)} /></label>
          <label>Payment method<select className="crm-input" value={method} onChange={e => { setMethod(e.target.value); setReference(""); }}><option value="cash">Cash</option><option value="mpesa">M-PESA</option><option value="card">Card (processor verification required)</option></select></label>
          <label>{method === "mpesa" ? "M-PESA receipt number" : "Receipt / transaction reference"}<input className="crm-input" required={method !== "mpesa" || !pending} disabled={method === "mpesa" && !!pending} value={method === "mpesa" && pending ? pendingReceipt : reference} onChange={e => setReference(e.target.value)} placeholder={method === "mpesa" ? "Safaricom receipt number" : "Receipt number"} /></label>
        </div>
        {method === "mpesa" && (pending ? <div style={{ marginTop: 12 }}>
          <p><strong>Pending M-PESA receipt: {pendingReceipt}</strong>. Verify this payment independently against your Safaricom statement before confirming.</p>
          <label>Independent verification reference<input className="crm-input" value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Safaricom statement or transaction verification reference" required minLength={5} /></label>
          <label style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}><input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} /> I have independently verified the receipt, amount and booking.</label>
        </div> : <p style={{ fontSize: 12, color: "#668086" }}>Step 1: Submit the M-PESA receipt. Step 2: Verify it independently, then confirm payment. Submission alone does not enable check-in.</p>)}
        {method === "cash" && <p style={{ fontSize: 12, color: "#668086" }}>Only confirm cash actually received. Full settlement automatically enables check-in after refresh.</p>}
        {method === "card" && <p style={{ fontSize: 12, color: "#92520a" }}>Card settlement is disabled until a verified card processor integration is available.</p>}
        <button type="submit" className="crm-btn crm-primary" disabled={saving || !amount || method === "card" || (method === "mpesa" && pending && (!attested || evidence.trim().length < 5)) || (method === "mpesa" && !pending && !validMpesaReceipt) || (method === "cash" && !reference.trim())}>
          {saving ? "Processing…" : method === "mpesa" ? pending ? "Verify M-PESA & Confirm Payment" : "Submit M-PESA Receipt" : Number(amount) === balance ? "Confirm Complete Payment" : "Record Part Payment"}
        </button>
      </form>}
  </div>;
}

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
  const [bookingFlags, setBookingFlags] = useState({ blacklist: [], archived: [] });
  const [archivedBookings, setArchivedBookings] = useState([]);

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
  const [actionModal, setActionModal] = useState(null);
  const [actionForm, setActionForm] = useState({});
  const [modalError, setModalError] = useState("");
  const [refundModal, setRefundModal] = useState(null);
  const [refundSummary, setRefundSummary] = useState(null);
  const [refundForm, setRefundForm] = useState({ amount: "", method: "mpesa", status: "pending", reference: "", reason: "" });
  async function openRefund(booking) {
    setRefundModal(booking); setRefundSummary(null); setModalError("");
    try {
      const summary = await api(`/admin/bookings/${encodeURIComponent(booking.id)}/refund-summary`, {}, token);
      setRefundSummary(summary);
      setRefundForm({ amount: String(Math.min(summary.maximum_refundable, summary.potential_overpayment)), method: "mpesa", status: "pending", reference: "", reason: "Booking amendment or cancellation" });
    } catch (err) { setModalError(err.message); }
  }
  async function submitRefund(e) {
    e.preventDefault(); if (!refundModal || busy) return;
    setBusy(true); setModalError("");
    try {
      await api(`/admin/bookings/${encodeURIComponent(refundModal.id)}/refunds`, { method: "POST", body: JSON.stringify({ ...refundForm, amount: Number(refundForm.amount) }) }, token);
      setRefundModal(null); setRefundSummary(null); await refresh(); await reloadExtra();
      onNotice(refundForm.status === "completed" ? "Refund recorded as completed (external receipt required)." : "Refund recorded as pending. No money has been transferred.");
    } catch (err) { setModalError(err.message); } finally { setBusy(false); }
  }
  const openAction = (type, booking = null) => {
    setModalError("");
    setActionForm(type === "edit" ? {
      cottage_id: String(booking?.unit_id ?? booking?.cottage_id ?? ""),
      check_in: String(booking?.check_in || "").slice(0, 10),
      check_out: String(booking?.check_out || "").slice(0, 10),
      guests: Number(booking?.guests || 1),
      additional_guests: Array.from({ length: Math.max(0, Number(booking?.guests || 1) - 1) }, (_, i) => ({
        name: booking?.additional_guests?.[i]?.full_name || booking?.additional_guests?.[i]?.name || "",
        phone: booking?.additional_guests?.[i]?.phone || ""
      }))
    } : { reason: "", acknowledge: false });
    setActionModal({ type, booking });
  };
  const closeAction = () => { if (!busy) { setActionModal(null); setModalError(""); } };
  async function submitAction(e) {
    e.preventDefault();
    if (!actionModal || busy) return;
    const { type, booking: b } = actionModal;
    setModalError("");
    if (type === "edit") {
      const n = Number(actionForm.guests);
      if (!Number.isInteger(n) || n < 1 || n > 30) return setModalError("Enter a valid number of guests.");
      if (!actionForm.cottage_id) return setModalError("Select a cottage.");
      if (!actionForm.check_in || !actionForm.check_out || actionForm.check_out <= actionForm.check_in) return setModalError("Check-out must be after check-in.");
      if ((actionForm.additional_guests || []).length !== n - 1 || actionForm.additional_guests.some(g => !g.name.trim())) return setModalError("Enter the full name of every accompanying guest.");
    } else if (type !== "delete" && !actionForm.reason?.trim()) return setModalError("Please provide a reason.");
    if ((type === "delete" || type === "blacklist") && !actionForm.acknowledge) return setModalError("Tick the confirmation checkbox to continue.");
    setBusy(true);
    try {
      if (type === "edit") {
        await api(`/admin/bookings/${encodeURIComponent(b.id)}/details`, {
          method: "PATCH", body: JSON.stringify({
            cottage_id: actionForm.cottage_id, check_in: actionForm.check_in, check_out: actionForm.check_out,
            guests: Number(actionForm.guests), additional_guests: actionForm.additional_guests.map(g => ({ name: g.name.trim(), phone: g.phone?.trim() || "" }))
          })
        }, token);
      } else if (type === "cancel") {
        await api(`/admin/bookings/${encodeURIComponent(b.id)}/cancel`, { method: "POST", body: JSON.stringify({ reason: actionForm.reason.trim() }) }, token);
      } else if (type === "delete") {
        await api(`/admin/bookings/${encodeURIComponent(b.id)}`, { method: "DELETE" }, token);
      } else if (type === "blacklist") {
        await api("/admin/blacklist", { method: "POST", body: JSON.stringify({ name: current.name, phone: current.phone, email: current.email, reason: actionForm.reason.trim() }) }, token);
      }
      if (type !== "blacklist") await refresh();
      await reloadExtra();
      onNotice(({ edit: "Booking updated. Review any refund due.", cancel: "Booking cancelled. Review any refund due.", delete: "Booking archived for audit.", blacklist: "Guest added to booking restriction list." })[type]);
      setActionModal(null);
      if (type === "edit" || type === "cancel") await openRefund(b);
    } catch (err) { setModalError(err.message); } finally { setBusy(false); }
  }
  const reloadExtra = useCallback(async () => {
    const [r, n, c, e, flags, archived] = await Promise.all([
      api("/admin/mpesa", {}, token).catch(() => []),
      api("/admin/customer-notes", {}, token).catch(() => []),
      api("/admin/customers", {}, token).catch(() => []),
      api("/admin/stays", {}, token).catch(() => []),
      api("/admin/booking-flags", {}, token).catch(() => ({ blacklist: [], archived: [] })),
      api("/admin/archived-bookings", {}, token).catch(() => [])
    ]);
    setReceipts(Array.isArray(r) ? r : []);
    setNotes(Array.isArray(n) ? n : []);
    setCustomers(Array.isArray(c) ? c : []);
    setEvents(Array.isArray(e) ? e : []);
    setBookingFlags(flags && typeof flags === "object" ? flags : { blacklist: [], archived: [] });
    setArchivedBookings(Array.isArray(archived) ? archived : []);
  }, [token]);
  useEffect(() => { reloadExtra().catch(e => onError(e.message)); }, [reloadExtra]);
  const fmt = n => "KES " + Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 });
  const date = v => { if (!v) return "Not recorded"; const d = new Date(v); return Number.isNaN(+d) ? String(v).slice(0, 16) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }); };
  // Actual stay timestamps are separate from scheduled reservation dates.
  const stayRecord = (booking) => events.find(e =>
    (e.booking_id != null && String(e.booking_id) === String(booking.id)) ||
    (e.booking_reference != null && booking.ref != null && String(e.booking_reference) === String(booking.ref))
  );
  const stayTime = (value) => {
    if (!value) return "Not recorded";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) :
      d.toLocaleString("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) + " EAT";
  };
  const norm = v => String(v || "").trim().toLowerCase();
  const phoneKey = v => String(v || "").replace(/[^\d]/g, "");
  const people = new Map();
  // Do not merge guests merely because they share a name.
  const keyFor = b => { const p = phoneKey(b.phone || b.guest_phone), e = norm(b.email || b.guest_email); return p ? "p:" + p : e ? "e:" + e : "b:" + b.id; };
  for (const b of [...bookings, ...archivedBookings]) { const key = keyFor(b); if (!people.has(key)) people.set(key, { key, name: b.name || b.guest_name || "Unnamed guest", phone: b.phone || b.guest_phone || "", email: b.email || b.guest_email || "", bookings: [] }); people.get(key).bookings.push(b); }
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
  const blacklistedEntry = current && (bookingFlags.blacklist || []).find(entry => {
    const samePhone = phoneKey(entry.phone) && phoneKey(current.phone) === phoneKey(entry.phone);
    const sameEmail = norm(entry.email) && norm(current.email) === norm(entry.email);
    const nameOnly = !entry.phone && !entry.email && norm(entry.full_name) === norm(current.name);
    return samePhone || sameEmail || nameOnly;
  });
  const archivedIds = new Set((bookingFlags.archived || []).map(x => String(x.booking_id)));
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
    <style>{`
/* Compact, pill-shaped booking actions. Keep all four on one row when space allows. */
.ew-crm .crm-booking-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;width:100%;overflow:visible;}
.ew-crm .crm-booking-actions .crm-btn{flex:0 0 auto;min-width:max-content;white-space:nowrap;border-radius:999px;padding:8px 13px;font-size:11px;line-height:1.25;font-weight:700;}
.ew-crm .crm-booking-actions .crm-action-edit{background:#e7f2ff;border-color:#bad7f5;color:#174d83;}
.ew-crm .crm-booking-actions .crm-action-cancel{background:#fff3df;border-color:#f3d7a6;color:#87520b;}
.ew-crm .crm-booking-actions .crm-action-delete{background:#ffebed;border-color:#f4bec6;color:#9d2937;}
.ew-crm .crm-booking-actions .crm-action-blacklist{background:#f1eafa;border-color:#d9c3ee;color:#65328c;}
@media(max-width:560px){.ew-crm .crm-booking-actions{flex-wrap:wrap;}}
main:has(> .breadcrumb):has(.ew-crm){max-width:1740px!important;width:calc(100% - 40px)!important;margin-left:auto!important;margin-right:auto!important;padding-left:0!important;padding-right:0!important}@media(max-width:700px){main:has(> .breadcrumb):has(.ew-crm){width:calc(100% - 24px)!important}}.ew-crm *{box-sizing:border-box}.ew-crm button,.ew-crm input,.ew-crm select,.ew-crm textarea{font:inherit}.ew-crm button{cursor:pointer}.ew-crm button:disabled{opacity:.5;cursor:not-allowed}.ew-crm .crm-btn{border:1px solid #cbd8db;border-radius:10px;background:#fff;color:#173a40;padding:10px 15px;font-weight:600}.ew-crm .crm-primary{background:#103f43;color:#fff;border-color:#103f43}.ew-crm .crm-btn:hover:not(:disabled){filter:brightness(.94)}.ew-crm .crm-input{width:100%;padding:11px 13px;border:1px solid #cbd9db;border-radius:9px;background:#fff;color:#14383e}.ew-crm .crm-tabs{display:flex;gap:10px;flex-wrap:wrap}.ew-crm .crm-tabs button{flex:1;border:1px solid #d8e2e4;background:#fff;border-radius:26px;padding:11px;white-space:nowrap}.ew-crm .crm-tabs button.active{background:#104348;color:#fff}.ew-crm .crm-person{width:100%;text-align:left;border:1px solid #d9e5e2;border-radius:13px;padding:12px;background:#fff;margin:6px 0;display:flex;align-items:center;gap:12px}.ew-crm .crm-person.active{background:#e6f4ee;border-color:#64b6a3}.ew-crm .crm-avatar{width:50px;height:50px;border-radius:50%;background:#dceee4;display:grid;place-items:center;font-size:21px;color:#126047;flex-shrink:0}.ew-crm .crm-layout{display:grid;grid-template-columns:minmax(300px, 30%) minmax(0, 1fr);gap:20px;align-items:start}.ew-crm .crm-layout>aside,.ew-crm .crm-layout>main{min-width:0}.ew-crm .crm-layout>main{min-height:0}.ew-crm .crm-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.ew-crm .crm-actions{display:flex;gap:8px;flex-wrap:wrap}.ew-crm .crm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}.ew-crm .crm-grid>section,.ew-crm .crm-grid>div{min-width:0}.ew-crm .crm-detail{padding:11px 0;border-bottom:1px solid #e5eceb;display:flex;justify-content:space-between;gap:15px}.ew-crm .crm-muted{color:#668086}.ew-crm .crm-mini{font-size:12px}.ew-crm .crm-booking{padding:15px;border:1px solid #d9e5e2;border-radius:12px;margin:12px 0}.ew-crm .crm-chip{border-radius:20px;padding:5px 9px;font-size:11px;background:#e6f3ec;color:#146340;font-weight:700}@media(max-width:1180px){.ew-crm .crm-grid{grid-template-columns:1fr}}@media(max-width:1050px){.ew-crm .crm-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:750px){.ew-crm .crm-layout,.ew-crm .crm-grid{grid-template-columns:1fr}.ew-crm .crm-kpis{grid-template-columns:repeat(2,1fr)}.ew-crm .crm-head{flex-direction:column;align-items:flex-start!important}}`}</style>
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
        <div className="crm-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, marginBottom: 18 }}><div style={{ display: "flex", alignItems: "center", gap: 15 }}><div className="crm-avatar" style={{ width: 70, height: 70, fontSize: 27 }}>{current.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}</div><div><h2 style={{ fontSize: 24, margin: "0 0 6px" }}>{current.name} {blacklistedEntry && <span className="crm-status-badge crm-status-blacklisted">Blacklisted</span>} <span className="crm-chip">{current.segment} Customer</span></h2><div className="crm-muted crm-mini">{current.phone || "No phone"} · {current.email || "No email"}</div></div></div><div className="crm-actions">{current.phone && <a className="crm-btn" href={`tel:${current.phone}`}>☎ Call</a>}{current.email && <a className="crm-btn" href={`mailto:${current.email}`}>✉ Email</a>}<button className="crm-btn" onClick={() => { const msg = `Hello ${current.name}, thank you for choosing Ewalel Cottages. We would love to welcome you again.`; navigator.clipboard.writeText(msg).then(() => onNotice("Follow-up message copied; not sent.")).catch(() => onError("Clipboard unavailable")); }}>Follow Up</button></div></div>

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
             .map((b) => {
              const cancelled = b.status === "cancelled";
              const archived = archivedIds.has(String(b.id));
              const status = cancelled ? "cancelled" : stayStatus(b);
              // Only show Edited when an explicit audit field is returned by the API.
              const edited = Boolean(b.was_edited || b.is_edited || b.edit_count > 0 || b.last_edited_at || b.edited_at);
              const canManageStay = !cancelled && !archived;

              return (
                <div
                  key={b.id}
                  style={{
                    padding: 15,
                    borderBottom: "1px solid #dce7e2",
                  }}
                >
                  <div className="ew-stay-top-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 280px)", gap: 18, alignItems: "start" }}>
                    <div style={{ minWidth: 0 }}>
                      <strong className="ew-stay-booking-name">
                        {b.cottage_name || b.unit_id} · #{b.ref || b.id}
                      </strong>
                      <p style={{ margin: "12px 0 0" }}>
                        {date(b.check_in)} – {date(b.check_out)}
                      </p>
                    </div>

                    <div className="booking-status-column" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch", alignSelf: "start", marginTop: -12, minWidth: 0 }}>
                      <div className="ew-stay-flags" aria-label="Booking administrative status" style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 }}>
                        <span className={`ew-stay-flag ${cancelled ? "is-cancelled" : archived ? "is-archived" : "is-active"}`}>
                          {cancelled ? "Cancelled booking" : archived ? "Archived booking" : "Active booking"}
                        </span>
                        {blacklistedEntry && <span className="ew-stay-flag is-blacklisted">Blacklisted guest</span>}
                        {edited && <span className="ew-stay-flag is-edited">Edited booking</span>}
                      </div>
                      <p style={{ margin: "2px 0", fontSize: 13, textAlign: "right" }}>
                        Stay status: <strong>{status.replaceAll("_", " ")}</strong>
                      </p>
                      <div className="guest-scheduled-times" style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", margin: 0 }}>
                        <div style={{ padding: 12, background: "#fff", border: "1px solid #dce7e2", borderRadius: 10 }}>
                          <div style={{ fontSize: 12, color: "#537078" }}>Scheduled check-in time</div>
                          <strong>{formatScheduledTime(b.scheduled_check_in_time || b.check_in_time, "14:00")} (Kenya time)</strong>
                        </div>
                        <p className="ew-stay-actual-time"><strong>Actual check-in:</strong> {stayTime(stayRecord(b)?.actual_check_in || b.actual_check_in)}</p>
                        <div style={{ padding: 12, background: "#fff", border: "1px solid #dce7e2", borderRadius: 10 }}>
                          <div style={{ fontSize: 12, color: "#537078" }}>Scheduled check-out time</div>
                          <strong>{formatScheduledTime(b.scheduled_check_out_time || b.check_out_time, "10:00")} (Kenya time)</strong>
                        </div>
                        <p className="ew-stay-actual-time"><strong>Actual check-out:</strong> {stayTime(stayRecord(b)?.actual_check_out || b.actual_check_out)}</p>
                      </div>
                    </div>
                  </div>


                  {canManageStay && status !== "checked_out" && b.status !== "confirmed" && (
                    <GuestBalancePayment booking={b} payments={payments} receipts={receipts} token={token} refresh={refresh} reloadExtra={reloadExtra} onError={onError} onNotice={onNotice} />
                  )}

                  {!canManageStay ? (
                    <p className="ew-stay-blocked">{cancelled ? "Booking cancelled — check-in and payment actions unavailable." : "Booking archived — check-in and payment actions unavailable."}</p>
                  ) : status === "checked_out" ? (
                    <span className="crm-chip">Stay Completed</span>
                  ) : status !== "checked_in" && b.status !== "confirmed" ? (
                    <p style={{ color: "#92520a", fontSize: 13, margin: "10px 0" }}>
                      Check-in unavailable: booking is {String(b.status || "pending").replaceAll("_", " ")}. Complete and verify the outstanding payment first.
                    </p>
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
        {tab === "Bookings & Payments" && <div><h3>Bookings & Payments</h3>{current.bookings.map(b => {
          const ps = payments.filter(p => String(p.booking_id) === String(b.id)); const rs = receipts.filter(r => String(r.booking_id) === String(b.id)); return <div className="crm-booking" key={b.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16, alignItems: "start" }}><div><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><b>#{b.ref || b.id} · {b.cottage_name || b.unit_id}</b><span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}><span className="crm-chip">{String(b.status).replaceAll("_", " ")}</span>{archivedIds.has(String(b.id)) && <span className="crm-status-badge crm-status-archived">Archived</span>}{blacklistedEntry && <span className="crm-status-badge crm-status-blacklisted">Blacklisted guest</span>}</span></div><p className="crm-muted crm-mini">Booked {date(b.created_at)} · Stay {date(b.check_in)} – {date(b.check_out)}</p><p><b>Booking total:</b> {fmt(b.total)}</p>
            {ps.map(p => <p key={p.id} style={{ fontSize: 13, margin: "5px 0" }}>Payment: {p.payment_method} · {fmt(p.amount)} · {p.status} · Ref: {p.transaction_reference || "—"}</p>)}{rs.map(r => <p key={r.trans_id} style={{ fontSize: 13, margin: "5px 0" }}>M-PESA receipt: <b>{r.receipt_number || "Not provided"}</b> · {r.status} · {date(r.received_at)}</p>)}{!ps.length && !rs.length && <p className="crm-muted crm-mini">No recorded payment or receipt.</p>}
            <div className="crm-booking-actions" style={{ marginTop: 14 }}>
              <button type="button" className="crm-btn crm-action-edit" disabled={busy || b.status === "cancelled" || archivedIds.has(String(b.id))} onClick={() => openAction("edit", b)}>Edit Booking</button>
              <button type="button" className="crm-btn crm-action-cancel" disabled={busy || b.status === "cancelled" || archivedIds.has(String(b.id))} onClick={() => openAction("cancel", b)}>Cancel Booking</button>
              <button type="button" className="crm-btn crm-action-blacklist" disabled={busy || !!blacklistedEntry} onClick={() => openAction("blacklist", b)}>{blacklistedEntry ? "Already Blacklisted" : "Blacklist Guest"}</button>
              <button type="button" className="crm-btn crm-action-delete" disabled={busy || archivedIds.has(String(b.id))} onClick={() => openAction("delete", b)}>{archivedIds.has(String(b.id)) ? "Archived" : "Delete Booking"}</button>
            </div>
            {events.filter(e => String(e.booking_id) === String(b.id) && e.event_type).map(e => <p key={e.id} className="crm-muted crm-mini">{String(e.event_type || e.stay_status || "Stay update").replaceAll("_", " ")}: {date(e.created_at)}</p>)}</div><aside style={{ padding: 16, borderRadius: 12, border: "1px solid #cce1d9", background: "#f1f8f5", minWidth: 0 }}><h4 style={{ margin: "0 0 12px", color: "#103f43" }}>Guests accompanying this booking</h4><p style={{ margin: "0 0 8px" }}><b>Primary guest:</b> {b.name || b.guest_name || current.name}</p><p className="crm-muted crm-mini">Total guests: {Number(b.guests) || 1}</p>{Array.isArray(b.additional_guests) && b.additional_guests.length ? <ol style={{ paddingLeft: 20, marginBottom: 0 }}>{b.additional_guests.map((guest, index) => <li key={guest.guest_order || index} style={{ marginBottom: 9 }}><b>{guest.full_name || guest.name || `Guest ${index + 2}`}</b>{guest.phone ? <div className="crm-muted crm-mini">{guest.phone}</div> : null}</li>)}</ol> : <p className="crm-muted crm-mini">{Number(b.guests) > 1 ? "Accompanying guest names have not been recorded for this booking." : "No accompanying guests."}</p>}</aside></div>
        })}{!current.bookings.length && <p>No bookings yet.</p>}</div>}
        {tab === "Activity & Notes" && <div><h3>Customer Activity & Notes</h3><form onSubmit={saveNote}><textarea className="crm-input" rows={3} placeholder="Add an internal customer service note" value={noteText} onChange={e => setNoteText(e.target.value)} required /><button className="crm-btn crm-primary" style={{ marginTop: 10 }} disabled={busy || !noteText.trim()}>Save Note</button></form><div style={{ marginTop: 18 }}>{notes.filter(n => customerRow && String(n.customer_id) === String(customerRow.id)).map(n => <div className="crm-booking" key={n.id}><p>{n.note}</p><small className="crm-muted">{date(n.created_at)}</small></div>)}{!customerRow && <p className="crm-muted">No saved customer notes.</p>}</div></div>}
        {tab === "Preferences" && <form onSubmit={savePreferences}><h3>Guest Preferences</h3><label>Preferred cottage<input className="crm-input" value={pref.preferred_cottage} onChange={e => setPref({ ...pref, preferred_cottage: e.target.value })} /></label><label style={{ display: "block", marginTop: 14 }}>Special requests<textarea className="crm-input" rows={4} value={pref.special_requests} onChange={e => setPref({ ...pref, special_requests: e.target.value })} /></label><label style={{ display: "flex", alignItems: "center", gap: 9, margin: "14px 0" }}><input type="checkbox" checked={pref.marketing_consent} onChange={e => setPref({ ...pref, marketing_consent: e.target.checked })} /> Marketing consent recorded</label><p className="crm-muted crm-mini">Only tick this when the guest has explicitly consented. This does not send messages.</p><button className="crm-btn crm-primary" disabled={busy}>Save Preferences</button></form>}
        {tab === "Loyalty" && <section style={card}><h3>Customer Loyalty</h3><div className="crm-grid">{stat("Total bookings", current.bookings.length, T.blue)}{stat("Verified spending", fmt(current.total), T.gold)}</div><p style={{ marginTop: 20 }}>Customer segment: <b>{current.segment}</b></p><p className="crm-muted">Loyalty information is calculated from actual reservations and completed payments. No discount or loyalty points have been issued.</p><p>Marketing consent: <b>{customerRow?.marketing_consent ? "Recorded" : "Not recorded"}</b></p></section>}
      </>}</main></div>
    {actionModal && <div className="ew-action-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeAction(); }}>
      <form className="ew-action-modal" role="dialog" aria-modal="true" aria-labelledby="ew-action-title" onSubmit={submitAction}>
        <div className="ew-action-header">
          <div><div className="ew-action-eyebrow">EWALEL COTTAGES · RESERVATION MANAGEMENT</div>
            <h2 id="ew-action-title">{{ edit: "Edit booking", cancel: "Cancel booking", delete: "Archive booking", blacklist: "Restrict guest bookings" }[actionModal.type]}</h2>
            <p>{actionModal.type === "blacklist" ? current?.name : `Reservation #${actionModal.booking?.ref || actionModal.booking?.id}`}</p>
          </div><button type="button" className="ew-action-close" aria-label="Close" onClick={closeAction} disabled={busy}>×</button>
        </div>
        <div className="ew-action-body">
          {actionModal.type === "edit" ? <>
            <div className="ew-action-grid">
              <label className="ew-action-wide">Cottage<select required value={actionForm.cottage_id || ""} onChange={e => setActionForm(f => ({ ...f, cottage_id: e.target.value }))}>
                <option value="">Choose cottage</option>{cottages.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select></label>
              <label>Check-in date<input type="date" required value={actionForm.check_in || ""} onChange={e => setActionForm(f => ({ ...f, check_in: e.target.value }))} /></label>
              <label>Check-out date<input type="date" required min={actionForm.check_in || undefined} value={actionForm.check_out || ""} onChange={e => setActionForm(f => ({ ...f, check_out: e.target.value }))} /></label>
              <label className="ew-action-wide">Number of guests (including primary guest)<input type="number" min="1" max="30" required value={actionForm.guests || 1} onChange={e => setActionForm(f => { const n = Math.max(1, Math.min(30, Number(e.target.value) || 1)); return { ...f, guests: n, additional_guests: Array.from({ length: n - 1 }, (_, i) => f.additional_guests?.[i] || { name: "", phone: "" }) }; })} /></label>
            </div>
            {actionForm.additional_guests?.length > 0 && <div className="ew-action-guests"><h3>Accompanying guests ({actionForm.additional_guests.length})</h3>
              {actionForm.additional_guests.map((g, i) => <div key={i} className="ew-action-guest"><strong>Guest {i + 2}</strong><div className="ew-action-grid">
                <label>Full name<input required placeholder="Guest full name" value={g.name} onChange={e => setActionForm(f => ({ ...f, additional_guests: f.additional_guests.map((x, j) => i === j ? { ...x, name: e.target.value } : x) }))} /></label>
                <label>Phone (optional)<input placeholder="Phone number" value={g.phone || ""} onChange={e => setActionForm(f => ({ ...f, additional_guests: f.additional_guests.map((x, j) => i === j ? { ...x, phone: e.target.value } : x) }))} /></label>
              </div></div>)}
            </div>}
            <div className="ew-action-info">Availability, cottage capacity and pricing must be validated by the server. Existing payment records will not be modified automatically.</div>
          </> : <>
            <div className={`ew-action-info ${actionModal.type === "delete" ? "ew-action-danger" : ""}`}>
              {actionModal.type === "cancel" ? "This cancels the reservation. Payments already collected are not automatically refunded; review any refund obligation separately." : actionModal.type === "delete" ? "This archives the booking from active administration views. Financial and audit records should remain retained." : "Restrict this guest from making future reservations. The backend must also screen all accompanying guests for this restriction."}
            </div>
            {actionModal.type !== "delete" && <label className="ew-action-reason">Reason (required)<textarea required rows={4} placeholder={actionModal.type === "cancel" ? "Enter the cancellation reason..." : "Enter the reason for restricting this guest..."} value={actionForm.reason || ""} onChange={e => setActionForm(f => ({ ...f, reason: e.target.value }))} /></label>}
            {(actionModal.type === "delete" || actionModal.type === "blacklist") && <label className="ew-action-confirm"><input type="checkbox" checked={!!actionForm.acknowledge} onChange={e => setActionForm(f => ({ ...f, acknowledge: e.target.checked }))} /><span>I understand the consequences and confirm this action.</span></label>}
          </>}
          {modalError && <div role="alert" className="ew-action-error">{modalError}</div>}
        </div>
        <div className="ew-action-footer"><button type="button" className="ew-action-secondary" onClick={closeAction} disabled={busy}>Go back</button><button type="submit" disabled={busy} className={`ew-action-submit ew-action-${actionModal.type}`}>
          {busy ? "Processing…" : { edit: "Save changes", cancel: "Cancel reservation", delete: "Archive booking", blacklist: "Blacklist guest" }[actionModal.type]}
        </button></div>
      </form>
    </div>}
    {refundModal && <div className="ew-action-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setRefundModal(null) }}>
      <form className="ew-action-modal" role="dialog" aria-modal="true" aria-labelledby="ew-refund-title" onSubmit={submitRefund}>
        <div className="ew-action-header"><div><div className="ew-action-eyebrow">EWALEL COTTAGES · FINANCIAL REVIEW</div><h2 id="ew-refund-title">Refund processing</h2><p>Reservation #{refundModal.ref || refundModal.id}</p></div><button type="button" className="ew-action-close" onClick={() => setRefundModal(null)} disabled={busy}>×</button></div>
        <div className="ew-action-body">
          {refundSummary ? <>
            <div className="ew-refund-totals"><span>Revised booking total: <b>{fmt(refundSummary.booking_total)}</b></span><span>Verified payments: <b>{fmt(refundSummary.verified_paid)}</b></span><span>Already refunded: <b>{fmt(refundSummary.completed_refunds)}</b></span><span>Potential refund: <b>{fmt(refundSummary.potential_overpayment)}</b></span></div>
            <p className="ew-action-info">Refunds are subject to the booking cancellation policy. Recording an M-PESA or card refund does not send money. Process the transfer through your approved payment provider first, then enter its verified reference.</p>
            <div className="ew-action-grid">
              <label>Refund amount (KES)<input required type="number" min="0.01" step="0.01" max={refundSummary.maximum_refundable} value={refundForm.amount} onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))} /></label>
              <label>Refund method<select value={refundForm.method} onChange={e => setRefundForm(f => ({ ...f, method: e.target.value }))}><option value="mpesa">M-PESA</option><option value="cash">Cash</option><option value="card">Card</option><option value="bank">Bank transfer</option></select></label>
              <label>Refund status<select value={refundForm.status} onChange={e => setRefundForm(f => ({ ...f, status: e.target.value }))}><option value="pending">Pending — not paid</option><option value="completed">Completed — externally verified</option></select></label>
              <label>External transaction reference<input required={refundForm.status === "completed"} value={refundForm.reference} placeholder="Receipt / transaction ID" onChange={e => setRefundForm(f => ({ ...f, reference: e.target.value }))} /></label>
            </div>
            <label className="ew-action-reason">Reason / approval notes<textarea required rows={3} value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} /></label>
          </> : <p>Loading verified payment information…</p>}
          {modalError && <div role="alert" className="ew-action-error">{modalError}</div>}
        </div>
        <div className="ew-action-footer"><button type="button" className="ew-action-secondary" onClick={() => setRefundModal(null)} disabled={busy}>Close / Later</button><button type="submit" className="ew-action-submit" disabled={busy || !refundSummary || Number(refundForm.amount) <= 0}>{busy ? "Saving…" : "Record refund"}</button></div>
      </form>
    </div>}
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

  const monthKey = value => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: d.toLocaleDateString("en-GB", { month: "short" }), count: rows.filter(b => monthKey(b.created_at || b.createdAt) === key).length };
  });
  const maxMonth = Math.max(1, ...months.map(m => m.count));
  const trendPoints = months.map((m, i) => `${42 + i * 108},${178 - m.count / maxMonth * 135}`).join(" ");
  const statusSegments = [
    { label: "Confirmed", count: rows.filter(b => b.status === "confirmed").length, color: "#08625f" },
    { label: "Awaiting payment", count: rows.filter(b => b.status === "awaiting_payment").length, color: "#f7b96e" },
    { label: "Payment submitted", count: rows.filter(b => b.status === "payment_submitted").length, color: "#8fbaf1" },
    { label: "Awaiting confirmation", count: rows.filter(b => b.status === "awaiting_confirmation").length, color: "#a994ec" },
    { label: "Cancelled", count: rows.filter(b => b.status === "cancelled").length, color: "#e77c82" },
    { label: "Other", count: rows.filter(b => !["confirmed", "awaiting_payment", "payment_submitted", "awaiting_confirmation", "cancelled"].includes(b.status)).length, color: "#8294a2" },
  ];
  let running = 0;
  const donut = rows.length ? `conic-gradient(${statusSegments.filter(x => x.count).map(segment => {
    const a = running / rows.length * 100;
    running += segment.count;
    return `${segment.color} ${a}% ${running / rows.length * 100}%`;
  }).join(",")})` : "#e8efef";
  const confirmedRevenue = rows.filter(b => b.status === "confirmed").reduce((sum, b) => sum + (Number(displayTotal(b)) || 0), 0);
  const exportBookings = () => {
    const safe = v => `"${String(v ?? "").replace(/^[\s]*([=+@-])/, "'$1").replaceAll('"', '""')}"`;
    const csvRows = [["Reference", "Guest", "Cottage", "Check in", "Check out", "Total (KES)", "Status"], ...filtered.map(b => [displayRef(b), displayName(b), b.cottage_name || b.unit_id || "", fmtDate(b.check_in), fmtDate(b.check_out), displayTotal(b) ?? "", b.status])];
    const blob = new Blob(["\ufeff" + csvRows.map(r => r.map(safe).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ewalel-bookings.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return <section className="ew-booking-dashboard">
    <div className="ew-booking-hero">
      <div><div className="ew-hero-kicker">EWALel COTTAGES · RESERVATIONS</div><h1>Bookings Dashboard</h1><p>Manage reservations, track payments, and monitor guest stays.</p></div>
      <button type="button" className="ew-hero-button" onClick={() => { setSearch(""); setStatusFilter("All"); refresh(); }}><RefreshCw size={17} /> Refresh bookings</button>
    </div>
    <div className="ew-metrics">
      {[
        { label: "Total bookings", value: rows.length, icon: CalendarDays, color: "teal" },
        { label: "Confirmed booking value", value: money(confirmedRevenue), icon: TrendingUp, color: "cream" },
        { label: "Awaiting payment", value: rows.filter(b => b.status === "awaiting_payment").length, icon: CreditCard, color: "blue" },
        { label: "Payment submitted", value: rows.filter(b => b.status === "payment_submitted").length, icon: Clock, color: "purple" },
        { label: "Confirmed", value: rows.filter(b => b.status === "confirmed").length, icon: CircleCheck, color: "green" },
      ].map(metric => <article key={metric.label} className={`ew-metric ew-metric-${metric.color}`}><metric.icon size={25} /><div><span>{metric.label}</span><strong>{metric.value}</strong></div></article>)}
    </div>
    <div className="ew-analytics">
      <section className="ew-widget"><div className="ew-widget-head"><h2><BarChart3 size={19} /> Booking trends</h2><span>Last 6 months · booking creation dates</span></div>
        <div className="ew-chart"><svg viewBox="0 0 630 218" role="img" aria-label="Monthly booking counts for the last six months" preserveAspectRatio="none">
          {[43, 88, 133, 178].map(y => <line key={y} x1="35" y1={y} x2="610" y2={y} stroke="#e7eeee" strokeWidth="1" />)}
          <polygon points={`42,178 ${trendPoints} 582,178`} fill="#d8f2ed" opacity=".7" />
          <polyline points={trendPoints} fill="none" stroke="#05887d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {months.map((m, i) => <g key={m.key}><circle cx={42 + i * 108} cy={178 - m.count / maxMonth * 135} r="5" fill="#05887d" /><text x={42 + i * 108} y="207" textAnchor="middle" fontSize="14" fill="#617a7b">{m.label}</text><text x={42 + i * 108} y={Math.max(19, 165 - m.count / maxMonth * 135)} textAnchor="middle" fontSize="12" fill="#23645f">{m.count}</text></g>)}
        </svg></div>
      </section>
      <section className="ew-widget"><div className="ew-widget-head"><h2><CalendarCheck size={19} /> Booking status</h2><span>All reservations</span></div>
        <div className="ew-status-layout"><div className="ew-donut" style={{ background: donut }}><div><strong>{rows.length}</strong><span>Bookings</span></div></div>
          <div className="ew-legend">{statusSegments.filter(x => x.count > 0).map(x => <div key={x.label}><span className="ew-dot" style={{ background: x.color }} /><span>{x.label}</span><b>{x.count}</b><small>{Math.round(x.count / rows.length * 100)}%</small></div>)}</div>
        </div>
      </section>
    </div>
    <div className="ew-bottom">
      <section className="ew-widget ew-bookings-list"><div className="ew-widget-head"><h2><CalendarDays size={19} /> Reservations</h2><span>{filtered.length} shown</span></div>
        <div className="ew-filters"><label><Search size={17} /><input aria-label="Search bookings" placeholder="Search guest, reference or cottage" value={search} onChange={e => setSearch(e.target.value)} /></label><label><Filter size={16} /><select aria-label="Filter booking status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="All">All statuses</option>{statuses.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label></div>
        <div className="ew-table-scroll"><table className="ew-booking-table"><thead><tr><th>Reference / guest</th><th>Cottage</th><th>Stay dates</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(b => <tr key={b.id}><td><strong>#{displayRef(b)}</strong><small>{displayName(b)}</small></td><td>{b.cottage_name || b.unit_id || "—"}</td><td>{fmtDate(b.check_in)}<small>to {fmtDate(b.check_out)}</small></td><td><strong>{displayTotal(b) == null ? "—" : money(displayTotal(b))}</strong></td><td><span className="ew-status-pill" style={{ background: statusColor(b.status).bg, color: statusColor(b.status).text }}>{statusLabel(b.status)}</span></td><td><div className="ew-row-actions"><button type="button" title="View booking" aria-label={`View booking ${displayRef(b)}`} onClick={() => setViewBooking(b)}><Eye size={17} /></button>{eligible.some(x => x.id === b.id) && <button type="button" title="Review payment" aria-label={`Review payment ${displayRef(b)}`} onClick={() => { setReviewBookingId(String(b.id)); openConfirmation(); }}><CreditCard size={17} /></button>}{canCancel(b) && <button type="button" title="Cancel booking" aria-label={`Cancel booking ${displayRef(b)}`} disabled={cancellingId === b.id} onClick={() => cancelBooking(b)}><Ban size={17} /></button>}</div></td></tr>)}</tbody></table></div>
        {!filtered.length && <p className="ew-empty">No bookings match your search.</p>}
      </section>
      <aside className="ew-widget ew-quick"><div className="ew-widget-head"><h2>Quick actions</h2></div>
        <button type="button" onClick={() => { setReviewBookingId(""); openConfirmation(); }}><CreditCard size={19} /> Review payments & confirm <ArrowRight size={17} /></button>
        <button type="button" onClick={exportBookings}><Download size={19} /> Export bookings (CSV) <ArrowRight size={17} /></button>
        <div className="ew-quick-note"><Users size={19} /><div><strong>Guest management</strong><p>Use the Guests tab to manage guest profiles and stay records.</p></div></div>
      </aside>
    </div>
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

/* Guest stay: stack status below cottage details on narrow screens. */
