import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pool } from './db.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '32kb' }));
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;

app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'mysql' }); }
  catch (err) { console.error(err); res.status(503).json({ status: 'error', error: 'Database unavailable' }); }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const [properties] = await pool.query('SELECT id, name FROM properties');
    const [bookings] = await pool.query(`SELECT p.name AS unit, DATE_FORMAT(b.check_in, '%Y-%m-%d') AS checkIn,
      DATE_FORMAT(b.check_out, '%Y-%m-%d') AS checkOut
      FROM bookings b JOIN properties p ON p.id = b.property_id
      WHERE b.status IN ('pending','confirmed')`);
    const result = Object.fromEntries(properties.map(p => [p.name, []]));
    for (const b of bookings) result[b.unit].push([b.checkIn, b.checkOut]);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Could not load availability' }); }
});

app.post('/api/bookings', async (req, res) => {
  const { unit, checkIn, checkOut, guests, name, phone, email = '', notes = '', website = '' } = req.body || {};
  if (website) return res.status(400).json({ error: 'Invalid submission' });
  if (!validDate(checkIn) || !validDate(checkOut) || checkOut <= checkIn || checkIn < new Date().toISOString().slice(0,10))
    return res.status(400).json({ error: 'Invalid dates' });
  const count = Number(guests);
  if (!Number.isInteger(count) || count < 1 || typeof unit !== 'string' ||
      typeof name !== 'string' || !name.trim() || name.length > 120 ||
      typeof phone !== 'string' || !phone.trim() || phone.length > 40 ||
      typeof email !== 'string' || email.length > 200 ||
      typeof notes !== 'string' || notes.length > 1000)
    return res.status(400).json({ error: 'Invalid booking details' });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Lock the property row so simultaneous requests cannot reserve overlapping dates.
    const [properties] = await conn.execute('SELECT id, capacity, price_per_night FROM properties WHERE name = ? FOR UPDATE', [unit]);
    if (!properties.length) { await conn.rollback(); return res.status(400).json({ error: 'Unknown property' }); }
    const property = properties[0];
    if (count > property.capacity) { await conn.rollback(); return res.status(400).json({ error: 'Too many guests' }); }
    const [conflicts] = await conn.execute(`SELECT id FROM bookings WHERE property_id = ?
      AND status IN ('pending','confirmed') AND check_in < ? AND check_out > ? LIMIT 1`,
      [property.id, checkOut, checkIn]);
    if (conflicts.length) { await conn.rollback(); return res.status(409).json({ error: 'These dates have already been booked' }); }
    const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000);
    const totalKES = nights * Number(property.price_per_night);
    const id = randomUUID();
    await conn.execute(`INSERT INTO bookings
      (id, property_id, check_in, check_out, guests, guest_name, phone, email, notes, nights, total_kes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, property.id, checkIn, checkOut, count, name.trim(), phone.trim(), email, notes, nights, totalKES]);
    await conn.commit();
    res.status(201).json({ id, status: 'pending', totalKES });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch {} }
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Unable to save booking' });
  } finally { if (conn) conn.release(); }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API listening on ${port} (MySQL)`));
