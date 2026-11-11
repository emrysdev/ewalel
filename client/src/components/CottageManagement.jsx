
import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Pencil,
  Images,
  Trash2,
  X,
  Upload,
  Star, Search, House, Users, BedDouble, CalendarDays, Coins, Wrench, Images as GalleryIcon, LayoutDashboard, Tag, MapPin, ArrowUpRight, ChevronRight, ClipboardList, CheckCircle2, AlertCircle, TrendingUp, PlusCircle
} from "lucide-react";
import "./CottageManagement.css";
// import "./PropertyStudio.css";


// Use the Express backend locally and the current website in production.
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const BASE = (
  isLocal
    ? import.meta.env.VITE_API_URL || "http://localhost:4000"
    : window.location.origin
).replace(/\/$/, "");



function imageUrl(url) {
  if (!url) return "";
  const value = String(url).trim();
  if (!value) return "";
  if (/^(data:|blob:)/i.test(value)) return value;

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      // Old saved local URLs should use the active backend instead.
      if (["localhost", "127.0.0.1"].includes(parsed.hostname)) {
        return `${BASE}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return value;
    }
    return value;
  }

  const path = `/${value.replace(/^\/+/, "")}`;
  if (path.startsWith("/images/")) return path;
  return `${BASE}${path}`;
}

function CottagePhoto({ src, alt, style, showDetails = false }) {
  const [failed, setFailed] = useState(false);
  const resolvedUrl = imageUrl(src);
  useEffect(() => setFailed(false), [resolvedUrl]);

  if (!resolvedUrl || failed) {
    return (
      <div
        className="cm-no-image"
        style={{
          ...style,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "#e9eeee",
          color: "#53666a",
          textAlign: "center",
          padding: 12,
          overflowWrap: "anywhere",
        }}
      >
        <span>Photograph unavailable</span>
        {showDetails && (
          <>
            <small style={{ fontSize: 10, maxWidth: "100%" }}>
              {src ? String(src) : "No image URL in gallery record"}
            </small>
            {resolvedUrl && (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: "#075985" }}
              >
                Test image URL
              </a>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      style={style}
      loading="lazy"
      onError={() => {
        console.warn("Ewalel cottage photograph failed:", {
          source: src,
          resolvedUrl,
        });
        setFailed(true);
      }}
    />
  );
}

const emptyForm = {
  name: "",
  location: "",
  nightly_rate: "",
  capacity: 2,
  description: ""
};

// function imageUrl(url) {
//   if (!url) return "";
//   if (/^https?:\/\//i.test(url)) return url;
//   return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
// }

export default function CottageManagement({
  cottages = [],
  token,
  onRefresh,
  bookings = [],
  maintenance = []
}) {
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [section, setSection] = useState("Overview");
  const [query, setQuery] = useState("");
  const [photoCottage, setPhotoCottage] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [error, setError] = useState("");
  const [galleryError, setGalleryError] = useState("");

  async function request(path, options = {}) {
    const response = await fetch(`${BASE}/api${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  async function uploadPhotos(cottageId, files) {
    if (!files.length) return;

    if (files.length > 10) {
      throw new Error("Select no more than 10 photographs.");
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(`${file.name} exceeds the 5 MB limit.`);
      }

      if (
        !["image/jpeg", "image/png", "image/webp"]
          .includes(file.type)
      ) {
        throw new Error(`${file.name} is not a supported image.`);
      }
    }

    const data = new FormData();

    files.forEach(file => {
      data.append("photos", file);
    });

    return request(`/admin/cottages/${cottageId}/photos`, {
      method: "POST",
      body: data
    });
  }

  function openAdd() {
    setEditing("new");
    setForm({ ...emptyForm });
    setSelectedPhotos([]);
    setError("");
  }

  function openEdit(cottage) {
    setEditing(cottage);
    setForm({
      name: cottage.name || "",
      location: cottage.location || "",
      nightly_rate: cottage.nightly_rate ?? "",
      capacity: cottage.capacity ?? 2,
      description: cottage.description || ""
    });
    setSelectedPhotos([]);
    setError("");
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setSelectedPhotos([]);
    setError("");
  }

  async function saveCottage(e) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const isNew = editing === "new";

      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        description: form.description,
        nightly_rate: Number(form.nightly_rate),
        capacity: Number(form.capacity)
      };

      const saved = await request(
        isNew
          ? "/admin/cottages"
          : `/admin/cottages/${editing.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const cottageId = isNew ? saved.id : editing.id;

      if (selectedPhotos.length) {
        if (!cottageId) {
          throw new Error(
            "Cottage saved but no cottage ID was returned."
          );
        }

        await uploadPhotos(cottageId, selectedPhotos);
      }

      setEditing(null);
      setSelectedPhotos([]);
      await onRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function archiveCottage(cottage) {
    const confirmed = window.confirm(
      `Archive ${cottage.name}? Existing bookings will be preserved.`
    );

    if (!confirmed) return;

    try {
      setError("");

      await request(`/admin/cottages/${cottage.id}`, {
        method: "DELETE"
      });

      await onRefresh?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadGallery(cottageId) {
    setLoadingGallery(true);
    setGalleryError("");

    try {
      const photos = await request(
        `/admin/cottages/${cottageId}/photos`
      );

      setGallery(Array.isArray(photos) ? photos : []);
    } catch (err) {
      setGalleryError(err.message);
    } finally {
      setLoadingGallery(false);
    }
  }

  function openGallery(cottage) {
    setPhotoCottage(cottage);
    setGallery([]);
    setGalleryFiles([]);
    setGalleryError("");
  }

  useEffect(() => {
    if (photoCottage?.id) {
      loadGallery(photoCottage.id);
    }
  }, [photoCottage?.id]);

  async function addGalleryPhotos() {
    if (!photoCottage || !galleryFiles.length || saving) return;

    setSaving(true);
    setGalleryError("");

    try {
      await uploadPhotos(photoCottage.id, galleryFiles);
      setGalleryFiles([]);
      await loadGallery(photoCottage.id);
      await onRefresh?.();
    } catch (err) {
      setGalleryError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function setCover(photo) {
    if (!photoCottage || saving) return;

    setSaving(true);
    setGalleryError("");

    try {
      await request(
        `/admin/cottages/${photoCottage.id}/photos/${photo.id}/cover`,
        { method: "PATCH" }
      );

      await loadGallery(photoCottage.id);
      await onRefresh?.();
    } catch (err) {
      setGalleryError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePhoto(photo) {
    if (!photoCottage || saving) return;

    if (!window.confirm("Delete this photograph permanently?")) {
      return;
    }

    setSaving(true);
    setGalleryError("");

    try {
      await request(
        `/admin/cottages/${photoCottage.id}/photos/${photo.id}`,
        { method: "DELETE" }
      );

      await loadGallery(photoCottage.id);
      await onRefresh?.();
    } catch (err) {
      setGalleryError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selected = cottages.find(c => String(c.id) === String(selectedId)) || cottages[0];
  const visible = cottages.filter(c => `${c.name} ${c.location}`.toLowerCase().includes(query.toLowerCase()));
  const active = cottages.filter(c => c.active !== false && c.active !== 0 && c.active !== "0");
  const money = v => `KES ${Number(v || 0).toLocaleString("en-KE")}`;
  const propertyBookings = selected ? bookings.filter(b => String(b.cottage_id) === String(selected.id)) : [];
  const propertyMaintenance = selected ? maintenance.filter(m => String(m.cottage_id) === String(selected.id)) : [];
  const confirmed = propertyBookings.filter(b => ["confirmed", "checked_in", "checked_out"].includes(String(b.status).toLowerCase()));
  const openIssues = maintenance.filter(m => !["completed", "resolved", "closed"].includes(String(m.status).toLowerCase()));
  const today = new Date().toISOString().slice(0, 10);
  const occupied = cottages.filter(c => bookings.some(b => String(b.cottage_id) === String(c.id) && ["confirmed", "checked_in"].includes(String(b.status).toLowerCase()) && String(b.check_in || b.checkin_date || b.check_in_date || "").slice(0,10) <= today && String(b.check_out || b.checkout_date || b.check_out_date || "").slice(0,10) > today)).length;
  const bookingDatesAvailable = bookings.some(b => b.check_in || b.checkin_date || b.check_in_date);
  const stats = [
    { icon: House, label: "Total properties", value: String(cottages.length).padStart(2,"0") },
    { icon: Users, label: "Guest capacity", value: cottages.reduce((a,c)=>a+Number(c.capacity||0),0) },
    { icon: BedDouble, label: "Active listings", value: String(active.length).padStart(2,"0") },
    { icon: CalendarDays, label: "Occupancy today", value: bookingDatesAvailable && active.length ? `${Math.round(occupied/active.length*100)}%` : "—" },
    { icon: Wrench, label: "Maintenance alerts", value: openIssues.length },
    { icon: Coins, label: "Nightly value", value: money(active.reduce((a,c)=>a+Number(c.nightly_rate||0),0)) }
  ];
  return (
    <div className="cm-container ps-root">
      <header className="ps-hero"><div className="ps-hero-copy"><span>EWАLEL COTTAGES · ACCOMMODATION</span><h1>Property Management</h1><p>Manage your accommodation portfolio, availability, pricing and operations.</p></div><div className="ps-hero-count"><MapPin size={20}/><div><strong>{cottages.length} Properties</strong><small>Lake Elementaita</small></div></div></header>
      <div className="ps-stats">{stats.map(({icon:Icon,label,value})=><div className="ps-stat" key={label}><div className="ps-stat-icon"><Icon size={22}/></div><div><span>{label}</span><strong>{value}</strong></div></div>)}</div>
      <div className="ps-workspace">
        <aside className="ps-list-panel"><div className="ps-list-heading"><h2>Properties <span>({cottages.length})</span></h2><button className="ps-primary" onClick={openAdd}><Plus size={16}/> Add property</button></div><label className="ps-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search properties..." /></label><div className="ps-list">{visible.map(c=><button key={c.id} className={`ps-property ${selected && String(selected.id)===String(c.id)?"selected":""}`} onClick={()=>{setSelectedId(c.id);setSection("Overview")}}><CottagePhoto src={c.photo_url} alt={c.name}/><div className="ps-property-text"><div className="ps-property-title"><strong>{c.name}</strong><span className={c.active===false || c.active===0?"ps-inactive":"ps-active"}>{c.active===false || c.active===0?"Archived":"Active"}</span></div><small><MapPin size={12}/>{c.location}</small><small><Users size={12}/>{c.capacity} guests</small><b>{money(c.nightly_rate)} <em>/ night</em></b></div><ChevronRight size={18}/></button>)}{!visible.length && <p className="ps-muted">No matching properties.</p>}</div></aside>
        <section className="ps-detail-panel">{selected ? <>
          <div className="ps-profile"><CottagePhoto src={selected.photo_url} alt={selected.name}/><div className="ps-profile-text"><div className="ps-profile-title"><h2>{selected.name}</h2><span className="ps-active">{selected.active===false || selected.active===0?"Archived":"Active"}</span></div><div className="ps-meta"><span><MapPin size={15}/>{selected.location}</span><span><Users size={15}/>{selected.capacity} guests</span></div><strong>{money(selected.nightly_rate)} <small>/ night</small></strong></div><button className="ps-primary ps-edit" onClick={()=>openEdit(selected)}><Pencil size={16}/> Edit property</button></div>
          <nav className="ps-tabs">{[["Overview",LayoutDashboard],["Gallery",GalleryIcon],["Bookings",CalendarDays],["Pricing",Tag],["Maintenance",Wrench]].map(([name,Icon])=><button key={name} className={section===name?"active":""} onClick={()=>setSection(name)}><Icon size={16}/>{name}</button>)}</nav>
          {section==="Overview" && <><div className="ps-detail-grid"><article className="ps-panel"><h3><ClipboardList size={19}/> Property overview</h3><dl>{[["Property name",selected.name],["Location",selected.location],["Capacity",`${selected.capacity} guests`],["Nightly rate",money(selected.nightly_rate)],["Status",selected.active===false || selected.active===0?"Archived":"Active"]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>{selected.description && <p className="ps-description">{selected.description}</p>}</article><article className="ps-panel"><h3><TrendingUp size={19}/> Property activity</h3><div className="ps-mini-grid"><div><small>Total bookings</small><strong>{propertyBookings.length}</strong></div><div><small>Confirmed bookings</small><strong>{confirmed.length}</strong></div><div><small>Maintenance records</small><strong>{propertyMaintenance.length}</strong></div><div><small>Recorded revenue</small><strong className="ps-revenue-na">See Finance</strong></div></div><p className="ps-footnote">Booking counts use loaded records. Revenue is not estimated from reservations.</p></article></div><article className="ps-panel ps-quick"><h3><ArrowUpRight size={19}/> Quick actions</h3><div className="ps-action-grid"><button onClick={()=>{setSection("Gallery");openGallery(selected)}}><GalleryIcon size={19}/> Manage photos</button><button onClick={()=>setSection("Bookings")}><CalendarDays size={19}/> View bookings</button><button onClick={()=>setSection("Pricing")}><Tag size={19}/> Update pricing</button><button onClick={()=>setSection("Maintenance")}><Wrench size={19}/> Maintenance</button></div></article></>}
          {section==="Gallery" && <article className="ps-panel ps-tab-panel"><h3><GalleryIcon size={19}/> Property gallery</h3><p>Upload, review, set a cover image, or remove photographs for {selected.name}.</p><div className="ps-gallery-preview"><CottagePhoto src={selected.photo_url} alt={selected.name}/></div><button className="ps-primary" onClick={()=>openGallery(selected)}><GalleryIcon size={17}/> Open photo manager</button></article>}
          {section==="Bookings" && <article className="ps-panel ps-tab-panel"><h3><CalendarDays size={19}/> Reservations · {selected.name}</h3><p>{propertyBookings.length} booking record(s) associated with this property.</p><div className="ps-table-scroll"><table className="ps-table"><thead><tr><th>Booking</th><th>Guest</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead><tbody>{propertyBookings.map((b,i)=><tr key={b.id||i}><td>#{b.id||"—"}</td><td>{b.guest_name||b.customer_name||b.name||"—"}</td><td>{String(b.check_in||b.checkin_date||b.check_in_date||"—").slice(0,10)}</td><td>{String(b.check_out||b.checkout_date||b.check_out_date||"—").slice(0,10)}</td><td>{b.status||"—"}</td></tr>)}</tbody></table></div>{!propertyBookings.length&&<p className="ps-muted">No booking records found for this property.</p>}</article>}
          {section==="Pricing" && <article className="ps-panel ps-tab-panel"><h3><Tag size={19}/> Pricing & listing details</h3><div className="ps-price-big"><small>Current nightly rate</small><strong>{money(selected.nightly_rate)}</strong><span>per night</span></div><p>Update the nightly rate, capacity, description and property details using the existing secure edit form.</p><button className="ps-primary" onClick={()=>openEdit(selected)}><Pencil size={16}/> Edit pricing</button></article>}
          {section==="Maintenance" && <article className="ps-panel ps-tab-panel"><h3><Wrench size={19}/> Property maintenance</h3><p>{propertyMaintenance.length} maintenance record(s) for {selected.name}. New tasks can be created from the main Maintenance section.</p>{propertyMaintenance.map((m,i)=><div className="ps-maintenance-row" key={m.id||i}><Wrench size={16}/><strong>{m.task||m.title||"Maintenance task"}</strong><span>{m.status||"Pending"}</span></div>)}{!propertyMaintenance.length&&<p className="ps-muted">No maintenance records for this property.</p>}</article>}
        </>:<div className="ps-empty"><House size={36}/><h2>No properties yet</h2><p>Add your first cottage to begin managing your accommodation portfolio.</p><button className="ps-primary" onClick={openAdd}><Plus size={16}/> Add property</button></div>}</section>
      </div>
      {error && !editing && <p className="cm-error">{error}</p>}
      {/* ADD / EDIT COTTAGE */}

      {editing && (
        <div className="cm-overlay">
          <form className="cm-modal" onSubmit={saveCottage}>
            <div className="cm-modal-header">
              <h2>
                {editing === "new"
                  ? "Add cottage"
                  : "Edit cottage"}
              </h2>

              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <p className="cm-error">{error}</p>
            )}

            <label>
              Cottage name
              <input
                required
                value={form.name}
                onChange={e =>
                  setForm({
                    ...form,
                    name: e.target.value
                  })
                }
              />
            </label>

            <label>
              Location
              <input
                required
                value={form.location}
                onChange={e =>
                  setForm({
                    ...form,
                    location: e.target.value
                  })
                }
              />
            </label>

            <label>
              Nightly price (KES)
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={form.nightly_rate}
                onChange={e =>
                  setForm({
                    ...form,
                    nightly_rate: e.target.value
                  })
                }
              />
            </label>

            <label>
              Maximum guests
              <input
                type="number"
                required
                min="1"
                step="1"
                value={form.capacity}
                onChange={e =>
                  setForm({
                    ...form,
                    capacity: e.target.value
                  })
                }
              />
            </label>

            <label>
              Description
              <textarea
                rows={3}
                value={form.description}
                onChange={e =>
                  setForm({
                    ...form,
                    description: e.target.value
                  })
                }
              />
            </label>

            <label className="cm-upload-label">
              Upload cottage photographs
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={e =>
                  setSelectedPhotos(
                    Array.from(e.target.files || [])
                  )
                }
              />
              <small>
                Select up to 10 photographs, maximum 5 MB each.
              </small>
            </label>

            {selectedPhotos.length > 0 && (
              <div className="cm-selected-photos">
                {selectedPhotos.map((file, index) => (
                  <p key={`${file.name}-${index}`}>
                    {file.name}
                  </p>
                ))}
              </div>
            )}

            <button
              type="submit"
              className="cm-add-btn"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
        </div>
      )}

      {/* PHOTO GALLERY */}

      {photoCottage && (
        <div className="cm-overlay">
          <div className="cm-modal">
            <div className="cm-modal-header">
              <h2>Photos — {photoCottage.name}</h2>

              <button
                type="button"
                disabled={saving}
                onClick={() => setPhotoCottage(null)}
              >
                <X size={20} />
              </button>
            </div>

            {galleryError && (
              <p className="cm-error">{galleryError}</p>
            )}

            <label className="cm-upload-label">
              Add photographs
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={e =>
                  setGalleryFiles(
                    Array.from(e.target.files || [])
                  )
                }
              />
              <small>
                JPG, PNG or WebP. Up to 10 images, 5 MB each.
              </small>
            </label>

            {galleryFiles.length > 0 && (
              <p>{galleryFiles.length} photograph(s) selected</p>
            )}

            <button
              type="button"
              className="cm-add-btn"
              disabled={saving || galleryFiles.length === 0}
              onClick={addGalleryPhotos}
            >
              <Upload size={17} />
              {saving ? "Uploading..." : "Upload photos"}
            </button>

            {loadingGallery ? (
              <p>Loading photographs...</p>
            ) : gallery.length === 0 ? (
              <p>No photographs uploaded yet.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 16,
                  marginTop: 20
                }}
              >
                {gallery.map(photo => (
                  <div key={photo.id}>
                    <CottagePhoto
                      src={photo.photo_url}
                      alt={`${photoCottage.name} photograph`}
                      style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10 }}
                    />

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 8
                      }}
                    >
                      <button
                        type="button"
                        disabled={saving || Boolean(photo.is_cover)}
                        onClick={() => setCover(photo)}
                        title="Set as cover photograph"
                      >
                        <Star size={16} />
                        {photo.is_cover ? "Cover" : "Set cover"}
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => deletePhoto(photo)}
                        title="Delete photograph"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
