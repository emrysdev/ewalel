export const token = () => localStorage.getItem("ew_token");
export async function api(path, { method = "GET", body, form, auth } = {}) {
  const headers = {};
  if (auth) headers.Authorization = "Bearer " + token();
  if (body) headers["Content-Type"] = "application/json";
  const r = await fetch("/api" + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || "Something went wrong"); e.status = r.status; throw e; }
  return j;
}

// Download a file the server generates (needs the admin token, so a plain link will not work).
export async function download(path, filename) {
  const r = await fetch("/api" + path, { headers: { Authorization: "Bearer " + token() } });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "Download failed"); }
  const url = URL.createObjectURL(await r.blob()), a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
