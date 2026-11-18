import { useEffect, useMemo, useRef, useState } from "react";
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


// Leaflet is loaded only for the admin analytics map; no React dependency is required.
const leafletCss = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const leafletJs = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
let leafletPromise;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-ewalel-leaflet]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet"; link.href = leafletCss;
        link.dataset.ewalelLeaflet = "true";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = leafletJs; script.async = true;
      script.onload = () => window.L ? resolve(window.L) : reject(new Error("Map library unavailable"));
      script.onerror = () => reject(new Error("Could not load the map library"));
      document.head.appendChild(script);
    }).catch(error => { leafletPromise = null; throw error; });
  }
  return leafletPromise;
}
function VisitorMap({ locations }) {
  const containerRef = useRef(null);
  const [mapError, setMapError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let map;
    loadLeaflet().then(L => {
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([0, 20], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);
      const bounds = [];
      locations.forEach(item => {
        const coords = [item.latitude, item.longitude];
        bounds.push(coords);
        const circle = L.circleMarker(coords, {
          radius: Math.min(19, 6 + Math.sqrt(item.views) * 2),
          color: "#0a5448", fillColor: "#18836f", fillOpacity: 0.7, weight: 2,
        }).addTo(map);
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = item.label;
        const count = document.createElement("div");
        count.textContent = `${number(item.views)} page views`;
        popup.append(title, count);
        circle.bindPopup(popup);
      });
      if (bounds.length) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 7 });
      setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 100);
    }).catch(err => { if (!cancelled) setMapError(err.message); });
    return () => { cancelled = true; if (map) map.remove(); };
  }, [locations]);
  return <div className="va-map-wrap">
    <div ref={containerRef} className="va-map" role="img" aria-label="Map showing approximate visitor locations" />
    {mapError && <p className="va-map-message">{mapError}. Check your internet connection.</p>}
    {!locations.length && <p className="va-map-message">No mapped locations yet. Geolocation coordinates will appear for new public-IP visits.</p>}
  </div>;
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
  // Count recorded page views by country. These are not unique-person percentages.
  const countryLocations = useMemo(() => {
    const groups = new Map();
    for (const row of ipHistory) {
      const country = String(row.country || "").trim() || "Unknown location";
      groups.set(country, (groups.get(country) || 0) + Number(row.views || 0));
    }
    const total = [...groups.values()].reduce((sum, count) => sum + count, 0);
    return [...groups].map(([country, views]) => ({
      country, views, percent: total ? (views / total) * 100 : 0,
    })).sort((a, b) => b.views - a.views);
  }, [ipHistory]);
  const mappedLocations = useMemo(() => {
    const groups = new Map();
    for (const row of ipHistory) {
      const lat = Number(row.latitude), lon = Number(row.longitude);
      if (row.latitude == null || row.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
      if (!groups.has(key)) groups.set(key, { latitude: lat, longitude: lon, label: place(row), views: 0 });
      groups.get(key).views += Number(row.views || 0);
    }
    return [...groups.values()];
  }, [ipHistory]);

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

      <div className="va-grid-two va-location-grid">
        <div className="va-panel">
          <div className="va-panel-header"><div><h3>Visitor locations</h3><p className="va-hint">Share of recorded page views by country · Last 30 days</p></div><span className="va-pill">Countries</span></div>
          <div className="va-country-list">
            {countryLocations.map(item => <div className="va-country" key={item.country}>
              <div className="va-country-label"><span>{item.country}</span><strong>{item.percent.toFixed(1)}%</strong></div>
              <div className="va-country-track"><div className="va-country-fill" style={{ width: `${item.percent}%` }} /></div>
              <span className="va-country-views">{number(item.views)} page views</span>
            </div>)}
            {!countryLocations.length && <p className="va-hint">No visitor location data recorded yet.</p>}
          </div>
        </div>
        <div className="va-panel">
          <div className="va-panel-header"><div><h3>Visitor location map</h3><p className="va-hint">Approximate IP geolocation · Last 30 days</p></div><span className="va-pill">{number(mappedLocations.length)} mapped locations</span></div>
          <VisitorMap locations={mappedLocations} />
          <p className="va-privacy va-map-note">Map markers represent approximate network locations, not exact visitor addresses. Zoom and select a marker for details.</p>
        </div>
      </div>
      <p className="va-footer">Visitor statistics are estimates · IP data is sensitive and should remain accessible only to authorised administrators · Retention depends on backend cleanup settings</p>
    </>}
  </section>;
}
