
import React, { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Images,
  Trash2,
  X,
  Upload,
  Star
} from "lucide-react";
import "./CottageManagement.css";

const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

const emptyForm = {
  name: "",
  location: "",
  nightly_rate: "",
  capacity: 2,
  description: ""
};

function imageUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function CottageManagement({
  cottages = [],
  token,
  onRefresh
}) {
  const [editing, setEditing] = useState(null);
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

  return (
    <div className="cm-container">
      <div className="cm-heading">
        <div>
          <h1>Cottage management</h1>
          <p>Manage your cottages, prices, details and photos</p>
        </div>
        <span className="cm-admin-badge">Admin</span>
      </div>

      <div className="cm-section-heading">
        <h2>Registered cottages</h2>

        <button
          className="cm-add-btn"
          onClick={openAdd}
          type="button"
        >
          <Plus size={17} />
          Add cottage
        </button>
      </div>

      {error && !editing && (
        <p className="cm-error">{error}</p>
      )}

      <div className="cm-grid">
        {cottages.map(cottage => (
          <article className="cm-card" key={cottage.id}>
            <div className="cm-image">
              {cottage.photo_url ? (
                <img
                  src={imageUrl(cottage.photo_url)}
                  alt={cottage.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                />
              ) : (
                <div className="cm-no-image">
                  No cottage photo
                </div>
              )}
            </div>

            <div className="cm-card-body">
              <h3>{cottage.name}</h3>

              <p>
                {cottage.location} · {cottage.capacity} guests
              </p>

              <strong>
                KES{" "}
                {Number(cottage.nightly_rate || 0)
                  .toLocaleString("en-KE")}{" "}
                / night
              </strong>

              {!cottage.active && (
                <p style={{ color: "#b45309" }}>
                  Archived
                </p>
              )}

              <div className="cm-actions">
                <button
                  type="button"
                  title="Edit cottage"
                  onClick={() => openEdit(cottage)}
                >
                  <Pencil size={17} />
                </button>

                <button
                  type="button"
                  title="Manage photographs"
                  onClick={() => openGallery(cottage)}
                >
                  <Images size={17} />
                </button>

                <button
                  type="button"
                  title="Archive cottage"
                  disabled={!cottage.active}
                  onClick={() => archiveCottage(cottage)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {cottages.length === 0 && (
        <p>No cottages registered yet.</p>
      )}

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
                    <img
                      src={imageUrl(photo.photo_url)}
                      alt={`${photoCottage.name} photograph`}
                      style={{
                        width: "100%",
                        height: 140,
                        objectFit: "cover",
                        borderRadius: 10
                      }}
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
