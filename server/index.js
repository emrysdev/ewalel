require("dotenv").config();
const express = require("express"), multer = require("multer"), crypto = require("crypto"), fs = require("fs"), path = require("path");
const store = require("./db"), analytics = require("./analytics"), exporter = require("./exporter");
const E = process.env, PORT = E.PORT || 4000, ADMIN_PASSWORD = E.ADMIN_PASSWORD || "change-me", SECRET = E.TOKEN_SECRET || "dev-secret";
const MPESA_MODE = E.MPESA_MODE || "manual", MPESA_SECRET = E.MPESA_SECRET || "change-me", HOLD_HOURS = +E.HOLD_HOURS || 24;
const UP = path.join(__dirname, "uploads");
fs.mkdirSync(UP, { recursive: true });

// ---- helpers
const iso = /^\d{4}-\d{2}-\d{2}$/, STATUS = ["awaiting_payment", "payment_submitted", "confirmed", "cancelled"];
const today = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);           // Nairobi date
const addDays = (d, k) => new Date(Date.parse(d) + k * 864e5).toISOString().slice(0, 10);
const nightsOf = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const clean = (v, n) => String(v || "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
const digits = p => String(p || "").replace(/\D/g, "").slice(-9);
const bad = (res, error, code = 400) => res.status(code).json({ error });
const fail = (msg, code = 400) => { throw Object.assign(new Error(msg), { status: code }); };
const h = fn => (q, r, next) => Promise.resolve(fn(q, r)).catch(next);                    // lets async handlers report errors
const uid = () => crypto.randomBytes(6).toString("hex");
const newRef = () => "EW" + crypto.randomBytes(3).toString("hex").toUpperCase();
// A booking blocks dates if it is paid/submitted, or unpaid but still inside the hold window.
const live = b => ["confirmed", "payment_submitted"].includes(b.status) || (b.status === "awaiting_payment" && Date.now() - b.createdAt < HOLD_HOURS * 36e5);
const LIVE_SQL = "(status IN ('confirmed','payment_submitted') OR (status='awaiting_payment' AND created_at > ?))";
const ranges = (db, unitId) => ({
  booked: db.bookings.filter(b => b.unitId === unitId && live(b)).map(b => [b.checkIn, b.checkOut]),
  maintenance: db.blocks.filter(x => x.unitId === unitId).map(x => [x.from, addDays(x.to, 1)])
});
// Inside a transaction: lock the penthouse row so two guests cannot take the same dates at once, then check for clashes.
const lock = (c, unitId) => c.query("SELECT id FROM units WHERE id=? FOR UPDATE", [unitId]);
async function isFree(c, unitId, a, b, skip = "") {
  const [[x]] = await c.query(`SELECT COUNT(*) n FROM bookings WHERE unit_id=? AND check_in<? AND check_out>? AND id<>? AND ${LIVE_SQL}`, [unitId, b, a, skip, Date.now() - HOLD_HOURS * 36e5]);
  const [[y]] = await c.query("SELECT COUNT(*) n FROM blocks WHERE unit_id=? AND from_date<? AND to_date>=?", [unitId, b, a]);
  return !x.n && !y.n;
}
const insertBooking = (c, b) => c.query("INSERT INTO bookings (id, ref, unit_id, check_in, check_out, nights, guests, name, phone, email, notes, total, deposit, status, receipt, source, created_at, confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  [b.id, b.ref, b.unitId, b.checkIn, b.checkOut, b.nights, b.guests, b.name, b.phone, b.email, b.notes, b.total, b.deposit, b.status, b.receipt, b.source, b.createdAt, b.confirmedAt]);
const getSettings = async () => Object.fromEntries((await store.q("SELECT name, value FROM settings")).map(x => [x.name, JSON.parse(x.value)]));
const setSetting = (name, v) => store.q("INSERT INTO settings (name, value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)", [name, JSON.stringify(v)]);
const unitOf = async id => (await store.load()).units.find(x => x.id === id);

async function notify(subject, text) {
  try {
    if (E.CALLMEBOT_APIKEY && E.OWNER_WHATSAPP)
      await fetch(`https://api.callmebot.com/whatsapp.php?phone=${E.OWNER_WHATSAPP}&text=${encodeURIComponent(subject + "\n" + text)}&apikey=${E.CALLMEBOT_APIKEY}`);
    if (E.SMTP_HOST && E.OWNER_EMAIL)
      await require("nodemailer").createTransport({ host: E.SMTP_HOST, port: +E.SMTP_PORT || 587, auth: { user: E.SMTP_USER, pass: E.SMTP_PASS } })
        .sendMail({ from: E.SMTP_USER, to: E.OWNER_EMAIL, subject, text });
  } catch (e) { console.error("notify failed:", e.message); }
}
const tell = (subject, b, extra = "") => store.q("SELECT name FROM units WHERE id=?", [b.unitId])
  .then(([u]) => notify(subject, `${b.ref}: ${u?.name}, ${b.checkIn} to ${b.checkOut} (${b.nights} nights), KES ${b.total}\n${b.name}, ${b.phone}, ${b.guests} guests${extra}`)).catch(() => {});

// ---- admin auth: signed, expiring token
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString("base64url"); return b + "." + crypto.createHmac("sha256", SECRET).update(b).digest("base64url"); };
const verify = t => { const [b, s] = String(t || "").split("."); if (!b || !s) return false;
  const ok = crypto.createHmac("sha256", SECRET).update(b).digest("base64url");
  return s.length === ok.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(ok)) && JSON.parse(Buffer.from(b, "base64url")).exp > Date.now(); };
const admin = (q, r, next) => verify((q.headers.authorization || "").slice(7)) ? next() : bad(r, "Please sign in", 401);

const app = express();
app.use(express.json({ limit: "200kb" }));
app.use("/uploads", express.static(UP));
const upload = multer({ storage: multer.diskStorage({ destination: UP, filename: (q, f, cb) => cb(null, Date.now() + "-" + crypto.randomBytes(3).toString("hex") + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: 8e6 }, fileFilter: (q, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype)) });

// ================= public =================
app.get("/api/public", h(async (q, r) => {
  const db = await store.load();
  r.json({ units: db.units, availability: Object.fromEntries(db.units.map(u => [u.id, ranges(db, u.id)])),
    settings: { depositPercent: db.settings.depositPercent, till: db.settings.till, hero: db.settings.hero, murals: db.settings.murals, whatsapp: E.OWNER_WHATSAPP || "" } });
}));

app.post("/api/bookings", h(async (q, r) => {
  const { unitId, checkIn, checkOut, guests, name, phone, email, notes, website } = q.body || {};
  if (website) return r.json({});                                                      // honeypot
  const [u] = await store.q("SELECT * FROM units WHERE id=?", [unitId]);
  if (!u || !iso.test(checkIn) || !iso.test(checkOut) || checkOut <= checkIn || checkIn < today()) fail("Please choose your dates.");
  if (!clean(name, 80) || !/^\+?\d{9,15}$/.test(String(phone || "").replace(/[\s-]/g, ""))) fail("Please enter your name and a valid phone number.");
  if (!(+guests >= 1 && +guests <= u.cap)) fail(`${u.name} sleeps up to ${u.cap} guests.`);
  const st = await getSettings(), nights = nightsOf(checkIn, checkOut), total = nights * u.price;
  const b = { id: uid(), ref: newRef(), unitId, checkIn, checkOut, nights, guests: +guests, name: clean(name, 80), phone: clean(phone, 20), email: clean(email, 100), notes: clean(notes, 300), total,
    deposit: Math.ceil(total * st.depositPercent / 100), status: "awaiting_payment", receipt: null, source: "web", createdAt: Date.now(), confirmedAt: null };
  await store.tx(async c => { await lock(c, unitId); if (!(await isFree(c, unitId, checkIn, checkOut))) fail("Sorry, those dates were just taken. Please choose other dates.", 409); await insertBooking(c, b); });
  tell("New booking, awaiting payment", b);
  r.json({ booking: { ref: b.ref, total, deposit: b.deposit }, pay: { till: st.till, account: b.ref, amount: b.deposit, holdHours: HOLD_HOURS } });
}));

// Customer confirms with the receipt code from the M-Pesa SMS.
app.post("/api/bookings/confirm", h(async (q, r) => {
  const rc = clean(q.body?.receipt, 20).toUpperCase(), [row] = await store.q("SELECT * FROM bookings WHERE ref=?", [clean(q.body?.ref, 20).toUpperCase()]), b = row && store.mapBooking(row);
  if (!b || digits(b.phone) !== digits(q.body?.phone)) fail("We couldn't find that booking. Check your booking code and phone number.", 404);
  if (b.status === "confirmed") return r.json({ status: "confirmed" });
  if (b.status === "cancelled" || !live(b)) fail("This booking has expired. Please make a new booking.", 410);
  if (!/^[A-Z0-9]{10}$/.test(rc)) fail("An M-Pesa receipt number has 10 letters and numbers, for example QGH7XYZ123.");
  if ((await store.q("SELECT id FROM bookings WHERE receipt=? AND id<>?", [rc, b.id])).length) fail("That receipt has already been used for another booking.", 409);
  const [tx] = await store.q("SELECT * FROM mpesa_payments WHERE trans_id=?", [rc]);
  if (tx) {
    if (tx.amount < b.deposit) fail(`That payment is KES ${tx.amount}, but the deposit is KES ${b.deposit}.`);
    await store.q("UPDATE bookings SET status='confirmed', receipt=?, confirmed_at=? WHERE id=?", [rc, Date.now(), b.id]);
    tell("Booking CONFIRMED", b, "\nM-Pesa: " + rc); return r.json({ status: "confirmed" });
  }
  if (MPESA_MODE === "daraja") fail("We haven't received that payment yet. Please wait a minute and try again.", 404);
  await store.q("UPDATE bookings SET status='payment_submitted', receipt=? WHERE id=?", [rc, b.id]);
  tell("Verify M-Pesa payment", b, `\nReceipt: ${rc}\nDeposit due: KES ${b.deposit}`);
  r.json({ status: "payment_submitted" });
}));

// Safaricom Daraja C2B "confirmation URL": every payment to your till/paybill is posted here.
// (The URL must not contain the words mpesa or safaricom, or Daraja rejects it.)
app.post("/api/pay/confirm/:s", h(async (q, r) => {
  if (q.params.s !== MPESA_SECRET) return r.sendStatus(403);
  const t = q.body || {}, id = String(t.TransID || "").toUpperCase(), amount = Math.round(+t.TransAmount) || 0;
  if (id) {
    await store.q("INSERT IGNORE INTO mpesa_payments (trans_id, amount, msisdn, name, account, paid_at, received_at) VALUES (?,?,?,?,?,?,?)",
      [id, amount, t.MSISDN || null, [t.FirstName, t.LastName].filter(Boolean).join(" ") || null, t.BillRefNumber || null, t.TransTime || null, Date.now()]);
    const [row] = await store.q("SELECT * FROM bookings WHERE receipt=? AND status='payment_submitted' AND deposit<=?", [id, amount]);
    if (row) { await store.q("UPDATE bookings SET status='confirmed', confirmed_at=? WHERE id=?", [Date.now(), row.id]); tell("Booking CONFIRMED", store.mapBooking(row), "\nM-Pesa: " + id); }
  }
  r.json({ ResultCode: 0, ResultDesc: "Accepted" });
}));

// ================= admin =================
app.post("/api/admin/login", h(async (q, r) => {
  if (q.body?.password !== ADMIN_PASSWORD) { await new Promise(s => setTimeout(s, 800)); fail("Wrong password", 401); }
  r.json({ token: sign({ exp: Date.now() + 12 * 36e5 }) });
}));
app.get("/api/admin/data", admin, h(async (q, r) => {
  const db = await store.load();
  r.json({ units: db.units, bookings: db.bookings.map(b => ({ ...b, live: live(b) })), blocks: db.blocks, mpesa: db.mpesa, settings: db.settings, today: today() });
}));

app.patch("/api/admin/units/:id", admin, h(async (q, r) => {
  const [u] = await store.q("SELECT id FROM units WHERE id=?", [q.params.id]); if (!u) fail("Not found", 404);
  const p = q.body || {}, set = {};
  if ("price" in p) { if (!(+p.price >= 0)) fail("Enter a valid price"); set.price = Math.round(+p.price); }
  if ("cap" in p && +p.cap >= 1) set.cap = Math.round(+p.cap);
  for (const k of ["name", "beds", "blurb"]) if (k in p) set[k] = clean(p[k], 400);
  const keys = Object.keys(set);                                                      // column names come from the list above, never from the request
  if (keys.length) await store.q(`UPDATE units SET ${keys.map(k => k + "=?").join(", ")} WHERE id=?`, [...keys.map(k => set[k]), u.id]);
  r.json(await unitOf(u.id));
}));
app.patch("/api/admin/settings", admin, h(async (q, r) => {
  const p = q.body || {};
  if ("depositPercent" in p) { if (!(+p.depositPercent >= 0 && +p.depositPercent <= 100)) fail("Deposit must be 0 to 100"); await setSetting("depositPercent", +p.depositPercent); }
  if ("till" in p) await setSetting("till", clean(p.till, 20));
  r.json(await getSettings());
}));

app.post("/api/admin/units/:id/images", admin, upload.single("image"), h(async (q, r) => {
  const [u] = await store.q("SELECT id FROM units WHERE id=?", [q.params.id]); if (!u || !q.file) fail("Choose a JPG, PNG or WebP image under 8 MB.");
  await store.q("INSERT INTO unit_images (unit_id, url, position) SELECT ?, ?, COALESCE(MAX(position), -1) + 1 FROM unit_images WHERE unit_id=?", [u.id, "/uploads/" + q.file.filename, u.id]);
  r.json(await unitOf(u.id));
}));
app.post("/api/admin/units/:id/cover", admin, h(async (q, r) => {
  const u = await unitOf(q.params.id), url = q.body?.url; if (!u || !u.images.includes(url)) fail("Not found", 404);
  await store.tx(async c => { await c.query("DELETE FROM unit_images WHERE unit_id=?", [u.id]);
    for (const [i, x] of [url, ...u.images.filter(x => x !== url)].entries()) await c.query("INSERT INTO unit_images (unit_id, url, position) VALUES (?,?,?)", [u.id, x, i]); });
  r.json(await unitOf(u.id));
}));
app.delete("/api/admin/units/:id/images", admin, h(async (q, r) => {
  const u = await unitOf(q.params.id), url = q.query.url; if (!u || !u.images.includes(url)) fail("Not found", 404);
  await store.q("DELETE FROM unit_images WHERE unit_id=? AND url=?", [u.id, url]);
  const db = await store.load();
  if (!db.units.some(x => x.images.includes(url)) && !(db.settings.murals || []).some(m => m.url === url) && db.settings.hero !== url) fs.unlink(path.join(UP, path.basename(url)), () => {});
  r.json(await unitOf(u.id));
}));

app.post("/api/admin/bookings", admin, h(async (q, r) => {   // owner adds a booking (walk-in, Airbnb, phone call)
  const p = q.body || {}, [u] = await store.q("SELECT * FROM units WHERE id=?", [p.unitId]);
  if (!u || !iso.test(p.checkIn) || !iso.test(p.checkOut) || p.checkOut <= p.checkIn) fail("Choose the unit and valid dates.");
  const nights = nightsOf(p.checkIn, p.checkOut), total = p.total !== "" && p.total != null && +p.total >= 0 ? Math.round(+p.total) : nights * u.price;
  const b = { id: uid(), ref: newRef(), unitId: u.id, checkIn: p.checkIn, checkOut: p.checkOut, nights, guests: +p.guests || 1, name: clean(p.name, 80) || "Owner booking", phone: clean(p.phone, 20), email: "",
    notes: clean(p.notes, 300), total, deposit: 0, status: "confirmed", receipt: null, source: "admin", createdAt: Date.now(), confirmedAt: Date.now() };
  await store.tx(async c => { await lock(c, u.id); if (!(await isFree(c, u.id, b.checkIn, b.checkOut))) fail("Those dates clash with another booking or maintenance.", 409); await insertBooking(c, b); });
  r.json(b);
}));
app.patch("/api/admin/bookings/:id", admin, h(async (q, r) => {
  const [row] = await store.q("SELECT * FROM bookings WHERE id=?", [q.params.id]); if (!row) fail("Not found", 404);
  const b = store.mapBooking(row), p = q.body || {}, nb = { ...b };
  for (const k of ["name", "phone", "email", "notes"]) if (k in p) nb[k] = clean(p[k], 300);
  for (const k of ["guests", "total", "deposit"]) if (k in p && +p[k] >= 0) nb[k] = Math.round(+p[k]);
  for (const k of ["checkIn", "checkOut"]) if (k in p) { if (!iso.test(p[k])) fail("Invalid date"); nb[k] = p[k]; }
  if ("status" in p) { if (!STATUS.includes(p.status)) fail("Invalid status"); nb.status = p.status; if (p.status === "confirmed") nb.confirmedAt = Date.now(); if (p.status === "awaiting_payment") nb.createdAt = Date.now(); }
  if (nb.checkOut <= nb.checkIn) fail("Check-out must be after check-in");
  const moved = nb.checkIn !== b.checkIn || nb.checkOut !== b.checkOut;
  if (moved) { nb.nights = nightsOf(nb.checkIn, nb.checkOut); if (!("total" in p)) nb.total = nb.nights * (await store.q("SELECT price FROM units WHERE id=?", [b.unitId]))[0].price; }
  await store.tx(async c => {
    await lock(c, b.unitId);
    if ((moved || (live(nb) && !live(b))) && live(nb) && !(await isFree(c, b.unitId, nb.checkIn, nb.checkOut, b.id))) fail("Those dates clash with another booking or maintenance.", 409);
    await c.query("UPDATE bookings SET name=?, phone=?, email=?, notes=?, guests=?, total=?, deposit=?, check_in=?, check_out=?, nights=?, status=?, created_at=?, confirmed_at=? WHERE id=?",
      [nb.name, nb.phone, nb.email, nb.notes, nb.guests, nb.total, nb.deposit, nb.checkIn, nb.checkOut, nb.nights, nb.status, nb.createdAt, nb.confirmedAt, b.id]);
  });
  r.json(nb);
}));
app.delete("/api/admin/bookings/:id", admin, h(async (q, r) => { await store.q("DELETE FROM bookings WHERE id=?", [q.params.id]); r.json({ ok: true }); }));

app.post("/api/admin/blocks", admin, h(async (q, r) => {    // maintenance on a unit, from..to inclusive
  const p = q.body || {}, to = p.to || p.from, [u] = await store.q("SELECT id FROM units WHERE id=?", [p.unitId]);
  if (!u || !iso.test(p.from) || !iso.test(to) || to < p.from) fail("Choose the unit and the day(s).");
  const x = { id: uid(), unitId: u.id, from: p.from, to, reason: clean(p.reason, 200) || "Maintenance" };
  await store.q("INSERT INTO blocks (id, unit_id, from_date, to_date, reason) VALUES (?,?,?,?,?)", [x.id, x.unitId, x.from, x.to, x.reason]);
  const db = await store.load();
  r.json({ block: x, clashes: db.bookings.filter(b => b.unitId === x.unitId && live(b) && x.from < b.checkOut && addDays(x.to, 1) > b.checkIn).map(b => b.ref) });
}));
app.delete("/api/admin/blocks/:id", admin, h(async (q, r) => { await store.q("DELETE FROM blocks WHERE id=?", [q.params.id]); r.json({ ok: true }); }));

// ---- analytics and Excel exports (?from=YYYY-MM-DD&to=YYYY-MM-DD; default is the current year)
const period = q => { const y = today().slice(0, 4); let from = iso.test(q.from) ? q.from : y + "-01-01", to = iso.test(q.to) ? q.to : y + "-12-31";
  if (to < from) [from, to] = [to, from]; if (nightsOf(from, to) > 800) to = addDays(from, 800); return { from, to }; };
const analyse = async q => analytics.build(await store.load(), { ...period(q), today: today(), live, holdMs: HOLD_HOURS * 36e5 });
app.get("/api/admin/analytics", admin, h(async (q, r) => r.json(await analyse(q.query))));
app.get("/api/admin/export/:kind", admin, h(async (q, r) => {
  const db = await store.load(), wb = await exporter.workbook(q.params.kind, db, analytics.build(db, { ...period(q.query), today: today(), live, holdMs: HOLD_HOURS * 36e5 }));
  if (!wb) fail("Unknown export", 404);
  r.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  r.setHeader("Content-Disposition", `attachment; filename="ewalel-${q.params.kind}-${today()}.xlsx"`);
  await wb.xlsx.write(r); r.end();
}));

// ---- serve the built React app in production
const DIST = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(DIST)) { app.use(express.static(DIST)); app.get(/^\/(?!api|uploads).*/, (q, r) => r.sendFile(path.join(DIST, "index.html"))); }
app.use((e, q, r, n) => {
  if (e.status) return bad(r, e.message, e.status);
  if (e.code === "ER_DUP_ENTRY") return bad(r, "That booking code or receipt is already in use. Please try again.", 409);
  if (e.name === "MulterError") return bad(r, e.message, 400);
  console.error(e); bad(r, "Something went wrong. Please try again.", 500);
});

store.init().then(() => app.listen(PORT, () => console.log("Ewalel server on http://localhost:" + PORT)))
  .catch(e => { console.error(`\nCould not start: ${e.message}\nCheck DB_HOST, DB_USER, DB_PASSWORD and DB_NAME in server/.env, and that MySQL is running.\n`); process.exit(1); });
