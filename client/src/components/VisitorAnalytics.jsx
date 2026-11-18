import { useEffect, useMemo, useState } from "react";
import "./VisitorAnalytics.css";

const apiBase = () => (
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:4000" : window.location.origin)
).replace(/\/$/, "");

const number = value => Number(value || 0).toLocaleString("en-KE");
const place = row => [row?.city, row?.region, row?.country].filter(Boolean).join(", ") ||
  (["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(row?.ip_address) ? "Localhost" : "Unknown location");

const eatTime = value => {
  if (!value) return "—";
  const raw = String(value).trim();
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date);
};

function downloadCsv(rows) {
  const headings = ["IP address", "Location", "Page views", "Recorded identifiers", "First visit (EAT)", "Last visit (EAT)"];
  const safe = value => {
    const text = String(value ?? "");
    // Avoid spreadsheet formula execution when an exported field is opened in Excel.
    const guarded = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${guarded.replace(/"/g, '""')}"`;
  };
  const lines = [headings, ...rows.map(row => [
    row.ip_address, place(row), row.views, row.sessions,
    eatTime(row.first_visit), eatTime(row.last_visit),
  ])];
  const csv = "\uFEFF" + lines.map(line => line.map(safe).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "ewalel-visitor-ip-history.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VisitTracker() {
  useEffect(() => {
    const storageKey = "ewalel_visitor_id";
    let visitorId = sessionStorage.getItem(storageKey);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      sessionStorage.setItem(storageKey, visitorId);
    }
    let lastPath = "";
    const record = () => {
      const path = window.location.pathname;
      if (path.startsWith("/admin") || path === lastPath) return;
      lastPath = path;
      fetch(`${apiBase()}/api/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_id: visitorId, page: path, referrer: document.referrer }),
        keepalive: true,
      }).catch(() => {});
    };
    record();
    window.addEventListener("popstate", record);
    // Track React SPA navigation when history.pushState/replaceState is used.
    const onNavigate = () => record();
    window.addEventListener("ewalel:navigate", onNavigate);
    return () => {
      window.removeEventListener("popstate", record);
      window.removeEventListener("ewalel:navigate", onNavigate);
    };
  }, []);
  return null;
}

function DataTable({ headings, rows, empty, minWidth = 560 }) {
  return <div className="va-table-scroll"><table style={{ minWidth }}>
    <thead><tr>{headings.map(h => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.length ? rows : <tr><td className="va-empty" colSpan={headings.length}>{empty}</td></tr>}</tbody>
  </table></div>;
}

export default function VisitorAnalytics({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIp, setSelectedIp] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!token) { setLoading(false); setError("Sign in to view visitor analytics."); return; }
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${apiBase()}/api/admin/visitors`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Visitor analytics unavailable");
        if (active) { setData(json); setError(""); }
      } catch (e) { if (active) setError(e.message); }
      finally { if (active) setLoading(false); }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [token, refreshKey]);

  // Older backend versions return recent visits but no ip_history. Build a fallback
  // from those records so the IP table does not misleadingly show zero matching IPs.
  const ipHistory = useMemo(() => {
    if (Array.isArray(data?.ip_history) && data.ip_history.length) return data.ip_history;
    const grouped = new Map();
    for (const visit of data?.recent || []) {
      const ip = visit.ip_address;
      if (!ip) continue;
      if (!grouped.has(ip)) grouped.set(ip, {
        ip_address: ip, city: visit.city, region: visit.region, country: visit.country,
        views: 0, sessions: 0, first_visit: visit.visited_at, last_visit: visit.visited_at,
        _ids: new Set(),
      });
      const row = grouped.get(ip);
      row.views++;
      const identifier = visit.visitor_id || visit.session_id;
      if (identifier) row._ids.add(identifier);
      if (String(visit.visited_at) < String(row.first_visit)) row.first_visit = visit.visited_at;
      if (String(visit.visited_at) > String(row.last_visit)) row.last_visit = visit.visited_at;
    }
    return [...grouped.values()].map(({ _ids, ...row }) => ({ ...row, sessions: _ids.size }));
  }, [data]);

  const ips = useMemo(() => ipHistory.filter(row =>
    `${row.ip_address} ${place(row)}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [ipHistory, search]);
  const selectedVisits = useMemo(() => (data?.recent || []).filter(row => row.ip_address === selectedIp), [data, selectedIp]);
  const metrics = [
    { label: "Visitors today", value: data?.summary?.visitors_today, icon: "◉" },
    { label: "Page views today", value: data?.summary?.views_today, icon: "▤" },
    { label: "Visitors in 7 days", value: data?.summary?.visitors_7d, icon: "↗" },
    { label: "Visitors in 30 days", value: data?.summary?.visitors_30d, icon: "◎" },
  ];

  return <section className="visitor-analytics">
    <header className="va-hero">
      <div className="va-hero-copy">
        <p className="va-eyebrow">REPORTS &amp; ANALYTICS</p>
        <h2>Website visitors</h2>
        <p className="va-subtitle">Understand website traffic, visitor activity and your most popular pages. All reporting times use East Africa Time (EAT).</p>
      </div>
      <span className="va-live"><span className="va-live-dot" />Visitor tracking</span>
    </header>

    {loading && <p className="va-loading">Loading visitor statistics…</p>}
    {error && <div role="alert" className="va-error">{error} <button type="button" onClick={() => { setLoading(true); setRefreshKey(k => k + 1); }}>Retry</button></div>}
    {data && <>
      <div className="visitor-metrics">
        {metrics.map((metric, i) => <article key={metric.label}>
          <div className="va-metric-top"><span>{metric.label}</span><span className="va-metric-icon" aria-hidden="true">{metric.icon}</span></div>
          <strong>{number(metric.value)}</strong>
          <span className="va-metric-caption">{i === 1 ? "Recorded page opens" : "Estimated unique visitors"}</span>
        </article>)}
      </div>

      <div className="va-grid-two">
        <div className="va-panel">
          <div className="va-panel-header"><div><h3>Daily traffic</h3><p className="va-hint">Visitor activity over the last 30 days</p></div><span className="va-pill">30 days</span></div>
          <DataTable headings={["Date (EAT)", "Visitors", "Page views"]} empty="No daily traffic recorded yet."
            rows={(data.daily || []).map((d, i) => <tr key={i}><td>{String(d.day).slice(0, 10)}</td><td className="va-strong">{number(d.visitors)}</td><td>{number(d.views)}</td></tr>)} />
        </div>
        <div className="va-panel">
          <div className="va-panel-header"><div><h3>Most viewed pages</h3><p className="va-hint">Pages that attract the most traffic</p></div><span className="va-pill">Top pages</span></div>
          <DataTable headings={["Page", "Views"]} empty="No page views recorded yet."
            rows={(data.pages || []).map((p, i) => <tr key={i}><td><span className="va-page">{p.page}</span></td><td className="va-strong">{number(p.views)}</td></tr>)} />
        </div>
      </div>

      <div className="va-panel">
        <div className="va-panel-header"><div><h3>Visitor IP &amp; location history</h3><p className="va-hint">First and last recorded activity · Up to 30 days</p></div><span className="va-pill">{number(ips.length)} matching IPs</span></div>
        <p className="va-privacy">Locations appear only when recorded by the backend. IP addresses can be shared by multiple people and browser identifiers are not verified identities.</p>
        <div className="va-toolbar">
          <label className="va-search"><span aria-hidden="true">⌕</span><input aria-label="Search IP address or location" placeholder="Search IP, city, region or country…" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <button className="va-button va-button-primary" type="button" disabled={!ips.length} onClick={() => downloadCsv(ips)}>↓ Export CSV</button>
        </div>
        <DataTable minWidth={1000} headings={["IP address", "Location", "Page views", "Identifiers", "First visit (EAT)", "Last visit (EAT)", "History"]}
          empty={search ? "No IP addresses match your search." : "No IP history is available yet."}
          rows={ips.map(row => <tr key={row.ip_address}>
            <td><span className="va-ip">{row.ip_address}</span></td><td><span className="va-place">{place(row)}</span></td>
            <td className="va-strong">{number(row.views)}</td><td>{number(row.sessions)}</td>
            <td>{eatTime(row.first_visit)}</td><td>{eatTime(row.last_visit)}</td>
            <td><button className="va-button" type="button" onClick={() => setSelectedIp(selectedIp === row.ip_address ? "" : row.ip_address)}>{selectedIp === row.ip_address ? "Hide" : "View"}</button></td>
          </tr>)} />
        {selectedIp && <div className="va-history-detail">
          <div className="va-panel-header"><div><h3>Activity for {selectedIp}</h3><p className="va-hint">Available recent records only</p></div><button className="va-button" onClick={() => setSelectedIp("")}>Close</button></div>
          <DataTable headings={["Time (EAT)", "Page"]} empty="No recent visits available for this IP."
            rows={selectedVisits.map(v => <tr key={v.id}><td>{eatTime(v.visited_at)}</td><td><span className="va-page">{v.page_path}</span></td></tr>)} />
        </div>}
      </div>

      <div className="va-panel">
        <div className="va-panel-header"><div><h3>Recent visits</h3><p className="va-hint">Latest recorded website activity · Last 7 days</p></div><span className="va-pill">{number(data.recent?.length)} records</span></div>
        <DataTable minWidth={740} headings={["Time (EAT)", "IP address", "Location", "Page"]} empty="No recent visits recorded yet."
          rows={(data.recent || []).map(v => <tr key={v.id}><td>{eatTime(v.visited_at)}</td><td><span className="va-ip">{v.ip_address}</span></td><td><span className="va-place">{place(v)}</span></td><td><span className="va-page">{v.page_path}</span></td></tr>)} />
      </div>
      <p className="va-footer">Visitor statistics are estimates · IP data is sensitive and should remain accessible only to authorised administrators · Retention depends on backend cleanup settings</p>
    </>}
  </section>;
}
