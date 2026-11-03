
import React, { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function CottagePhotoManager({ cottages = [], token }) {
  const [selectedCottage, setSelectedCottage] = useState("");
  const [photos, setPhotos] = useState([]);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCottage && cottages.length > 0) {
      setSelectedCottage(String(cottages[0].id));
    }
  }, [cottages, selectedCottage]);

  useEffect(() => {
    if (!selectedCottage) return;

    let cancelled = false;
    setPhotos([]);

    async function loadPhotos() {
      try {
        const response = await fetch(
          `${API_URL}/api/cottages/${selectedCottage}/photos`
        );

        if (!response.ok) throw new Error("Could not load photos");

        const data = await response.json();
        if (!cancelled) {
          setPhotos(Array.isArray(data) ? data : data.photos || []);
        }
      } catch (error) {
        if (!cancelled) setMessage(error.message);
      }
    }

    loadPhotos();
    return () => { cancelled = true; };
  }, [selectedCottage]);

  async function uploadPhotos(event) {
    event.preventDefault();
    if (!selectedCottage || files.length === 0) return;

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      files.forEach(file => formData.append("photos", file));

      const response = await fetch(
        `${API_URL}/api/admin/cottages/${selectedCottage}/photos`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      setFiles([]);
      setMessage("Photos uploaded successfully");

      const updated = await fetch(
        `${API_URL}/api/cottages/${selectedCottage}/photos`
      );
      if (updated.ok) {
        const data = await updated.json();
        setPhotos(Array.isArray(data) ? data : data.photos || []);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deletePhoto(photoId) {
    if (!window.confirm("Delete this photo permanently?")) return;

    try {
      const response = await fetch(
        `${API_URL}/api/admin/photos/${photoId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error("Delete failed");

      setPhotos(current => current.filter(p => p.id !== photoId));
      setMessage("Photo deleted successfully");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section style={{ padding: 24 }}>
      <h2>Cottage Photo Management</h2>
      <p>Upload and manage photographs for each cottage.</p>

      <label htmlFor="cottage-select">Select cottage</label>
      <select
        id="cottage-select"
        value={selectedCottage}
        onChange={e => setSelectedCottage(e.target.value)}
      >
        <option value="">Choose a cottage</option>
        {cottages.map(cottage => (
          <option key={cottage.id} value={cottage.id}>
            {cottage.name}
          </option>
        ))}
      </select>

      <form onSubmit={uploadPhotos} style={{ marginTop: 20 }}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={e => setFiles(Array.from(e.target.files || []))}
        />

        <button
          type="submit"
          disabled={loading || !selectedCottage || files.length === 0}
        >
          {loading ? "Uploading..." : "Upload Photos"}
        </button>
      </form>

      {message && <p role="status">{message}</p>}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 16,
        marginTop: 24
      }}>
        {photos.map(photo => (
          <div key={photo.id}>
            <img
              src={new URL(photo.image_url, API_URL).href}
              alt="Cottage"
              style={{ width: "100%", borderRadius: 8 }}
            />
            <button
              type="button"
              onClick={() => deletePhoto(photo.id)}
            >
              Delete Photo
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
