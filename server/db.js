// MySQL access. The rest of the app works with plain objects; this file is the only place that knows about SQL tables.
const mysql = require("mysql2/promise"), fs = require("fs"), path = require("path");
const E = process.env, NAME = (E.DB_NAME || "ewalel").replace(/[^\w]/g, "");
const cfg = { host: E.DB_HOST || "127.0.0.1", port: +E.DB_PORT || 3306, user: E.DB_USER || "root", password: E.DB_PASSWORD || "", charset: "utf8mb4" };
let pool;

async function init({ seed = true } = {}) {
  const boot = await mysql.createConnection({ ...cfg, multipleStatements: true });       // only used here, to run schema.sql
  await boot.query(`CREATE DATABASE IF NOT EXISTS \`${NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await boot.query(`USE \`${NAME}\`; ` + fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  await boot.end();
  pool = mysql.createPool({ ...cfg, database: NAME, dateStrings: true, supportBigNumbers: true, bigNumberStrings: false, connectionLimit: 10 });
  const [[{ n }]] = await pool.query("SELECT COUNT(*) n FROM units");
  if (!n && seed) {                                                                       // first run: import the old JSON file if there is one, otherwise the starter data
    const old = path.join(__dirname, "data", "db.json");
    if (fs.existsSync(old)) { console.log("Empty database: importing data/db.json"); await importData(JSON.parse(fs.readFileSync(old, "utf8"))); }
    else { console.log("Empty database: adding starter data"); await importData(require("./seed")); }
  }
  return pool;
}
const q = async (sql, params) => (await pool.query(sql, params))[0];
async function tx(fn) {
  const c = await pool.getConnection();
  try { await c.beginTransaction(); const r = await fn(c); await c.commit(); return r; } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}

const mapBooking = r => ({ id: r.id, ref: r.ref, unitId: r.unit_id, checkIn: r.check_in, checkOut: r.check_out, nights: r.nights, guests: r.guests, name: r.name, phone: r.phone, email: r.email, notes: r.notes,
  total: r.total, deposit: r.deposit, status: r.status, receipt: r.receipt, source: r.source, createdAt: Number(r.created_at), confirmedAt: r.confirmed_at == null ? null : Number(r.confirmed_at) });

// Everything, as plain objects. Two units and a few thousand bookings fit comfortably in memory per request.
async function load() {
  const [us, im, bs, bl, mp, st] = await Promise.all([q("SELECT * FROM units ORDER BY sort_order, id"), q("SELECT unit_id, url FROM unit_images ORDER BY unit_id, position, id"),
    q("SELECT * FROM bookings ORDER BY created_at"), q("SELECT * FROM blocks ORDER BY from_date"), q("SELECT * FROM mpesa_payments ORDER BY received_at"), q("SELECT * FROM settings")]);
  return {
    units: us.map(u => ({ id: u.id, name: u.name, price: u.price, cap: u.cap, beds: u.beds, blurb: u.blurb || "", images: im.filter(x => x.unit_id === u.id).map(x => x.url) })),
    bookings: bs.map(mapBooking),
    blocks: bl.map(x => ({ id: x.id, unitId: x.unit_id, from: x.from_date, to: x.to_date, reason: x.reason })),
    mpesa: mp.map(x => ({ transId: x.trans_id, amount: x.amount, msisdn: x.msisdn, name: x.name, account: x.account, time: x.paid_at, receivedAt: Number(x.received_at) })),
    settings: Object.fromEntries(st.map(x => [x.name, JSON.parse(x.value)]))
  };
}

// Used for first-run seeding and for importing the old data/db.json. Existing rows are left alone.
async function importData(o) {
  await tx(async c => {
    for (const [i, u] of (o.units || []).entries()) {
      await c.query("INSERT IGNORE INTO units (id, name, price, cap, beds, blurb, sort_order) VALUES (?,?,?,?,?,?,?)", [u.id, u.name, u.price, u.cap, u.beds || "", u.blurb || "", i]);
      for (const [j, url] of (u.images || []).entries())
        await c.query("INSERT INTO unit_images (unit_id, url, position) SELECT ?,?,? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM unit_images WHERE unit_id=? AND url=?)", [u.id, url, j, u.id, url]);
    }
    for (const b of o.bookings || [])
      await c.query("INSERT IGNORE INTO bookings (id, ref, unit_id, check_in, check_out, nights, guests, name, phone, email, notes, total, deposit, status, receipt, source, created_at, confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [b.id, b.ref, b.unitId, b.checkIn, b.checkOut, b.nights, b.guests, b.name, b.phone || "", b.email || "", b.notes || "", b.total, b.deposit || 0, b.status, b.receipt || null, b.source || "web", b.createdAt, b.confirmedAt || null]);
    for (const x of o.blocks || []) await c.query("INSERT IGNORE INTO blocks (id, unit_id, from_date, to_date, reason) VALUES (?,?,?,?,?)", [x.id, x.unitId, x.from, x.to, x.reason || "Maintenance"]);
    for (const t of o.mpesa || []) await c.query("INSERT IGNORE INTO mpesa_payments (trans_id, amount, msisdn, name, account, paid_at, received_at) VALUES (?,?,?,?,?,?,?)", [t.transId, t.amount, t.msisdn || null, t.name || null, t.account || null, t.time || null, t.receivedAt || Date.now()]);
    for (const [k, v] of Object.entries(o.settings || {})) await c.query("INSERT IGNORE INTO settings (name, value) VALUES (?,?)", [k, JSON.stringify(v)]);
  });
}
module.exports = { init, q, tx, load, importData, mapBooking, close: () => pool && pool.end() };
