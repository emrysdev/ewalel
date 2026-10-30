// Business analytics. One source of truth: the dashboard charts and the Excel exports both use build().
const addDays = (d, k) => new Date(Date.parse(d) + k * 864e5).toISOString().slice(0, 10);
const nightsOf = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const digits = p => String(p || "").replace(/\D/g, "").slice(-9);
const mkey = d => d.slice(0, 7);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const sum = (l, f) => l.reduce((a, x) => a + f(x), 0);
const dayOf = ms => new Date(ms + 3 * 36e5).toISOString().slice(0, 10);

function build(db, { from, to, today, live, holdMs }) {
  const units = db.units, conf = db.bookings.filter(b => b.status === "confirmed");

  // ---- revenue and occupancy: each confirmed night earns total/nights, so stays spanning months split correctly
  const M = {}, row = k => M[k] || (M[k] = { month: k, byUnit: Object.fromEntries(units.map(u => [u.id, { revenue: 0, nights: 0, available: 0 }])) });
  for (let d = from; d <= to; d = addDays(d, 1))
    for (const u of units) if (!db.blocks.some(x => x.unitId === u.id && d >= x.from && d <= x.to)) row(mkey(d)).byUnit[u.id].available++; else row(mkey(d));
  for (const b of conf) { const per = b.total / b.nights;
    for (let d = b.checkIn; d < b.checkOut; d = addDays(d, 1)) { if (d < from || d > to) continue; const c = row(mkey(d)).byUnit[b.unitId]; if (c) { c.revenue += per; c.nights++; } } }
  const months = Object.values(M).sort((a, b) => (a.month < b.month ? -1 : 1)).map(m => {
    const l = Object.values(m.byUnit), revenue = Math.round(sum(l, x => x.revenue)), nights = sum(l, x => x.nights), available = sum(l, x => x.available);
    for (const x of l) { x.revenue = Math.round(x.revenue); x.occupancy = Math.min(100, pct(x.nights, x.available)); }
    return { month: m.month, byUnit: m.byUnit, revenue, nights, available, occupancy: Math.min(100, pct(nights, available)), adr: nights ? Math.round(revenue / nights) : 0, revpar: available ? Math.round(revenue / available) : 0 };
  });
  const revenue = sum(months, m => m.revenue), nights = sum(months, m => m.nights), available = sum(months, m => m.available);
  const byUnit = units.map(u => ({ id: u.id, name: u.name, revenue: sum(months, m => m.byUnit[u.id].revenue), nights: sum(months, m => m.byUnit[u.id].nights), available: sum(months, m => m.byUnit[u.id].available) }))
    .map(u => ({ ...u, occupancy: Math.min(100, pct(u.nights, u.available)) }));

  // ---- bookings whose check-in is inside the period
  const inP = conf.filter(b => b.checkIn >= from && b.checkIn <= to);
  const bucket = (list, defs, val) => defs.map(([label, test]) => ({ label, value: list.filter(b => test(val(b))).length }));
  const lead = b => nightsOf(dayOf(b.createdAt), b.checkIn);
  const leadTime = bucket(inP, [["Same week", x => x <= 7], ["1 to 4 weeks", x => x > 7 && x <= 30], ["1 to 3 months", x => x > 30 && x <= 90], ["Over 3 months", x => x > 90]], lead);
  const stayLength = bucket(inP, [["1 night", x => x === 1], ["2 nights", x => x === 2], ["3 nights", x => x === 3], ["4 to 6", x => x >= 4 && x <= 6], ["7+", x => x >= 7]], b => b.nights);
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({ label, value: inP.filter(b => (new Date(b.checkIn + "T00:00:00Z").getUTCDay() + 6) % 7 === i).length }));
  const source = ["web", "admin"].map(s => ({ label: s === "web" ? "Website" : "Added by owner", bookings: inP.filter(b => b.source === s).length, revenue: sum(inP.filter(b => b.source === s), b => b.total) }));

  // ---- booking funnel (website requests whose check-in is in the period)
  const web = db.bookings.filter(b => b.source === "web" && b.checkIn >= from && b.checkIn <= to), n = s => web.filter(b => b.status === s && (s !== "awaiting_payment" || live(b))).length;
  const took = web.filter(b => b.status === "confirmed" && b.confirmedAt && b.createdAt).map(b => (b.confirmedAt - b.createdAt) / 36e5);
  const funnel = { requests: web.length, awaiting: n("awaiting_payment"), expired: web.filter(b => b.status === "awaiting_payment" && !live(b)).length, submitted: n("payment_submitted"), confirmed: n("confirmed"), cancelled: n("cancelled"),
    conversion: pct(n("confirmed"), web.length), avgHoursToConfirm: took.length ? Math.round(sum(took, x => x) / took.length * 10) / 10 : 0 };

  // ---- money still to come (not limited to the period)
  const up = conf.filter(b => b.checkIn >= today), aw = db.bookings.filter(b => b.status === "awaiting_payment" && live(b)), sub = db.bookings.filter(b => b.status === "payment_submitted");
  const pipeline = { upcoming: { count: up.length, value: sum(up, b => b.total) }, balanceDue: sum(up.filter(b => b.source === "web"), b => Math.max(0, b.total - b.deposit)),
    awaiting: { count: aw.length, value: sum(aw, b => b.total), deposits: sum(aw, b => b.deposit) }, submitted: { count: sub.length, deposits: sum(sub, b => b.deposit) },
    expiringSoon: aw.filter(b => b.createdAt + holdMs - Date.now() < 6 * 36e5).length };

  // ---- clients (all time)
  const CL = {};
  for (const b of [...db.bookings].filter(b => b.status !== "cancelled").sort((a, c) => a.createdAt - c.createdAt)) {
    const k = digits(b.phone) || String(b.name).toLowerCase(), c = CL[k] || (CL[k] = { key: k, name: b.name, phone: "", email: "", bookings: 0, _s: [], lastBooked: 0 });
    c.name = b.name; c.phone = b.phone || c.phone; c.email = b.email || c.email; c.bookings++; c.lastBooked = Math.max(c.lastBooked, b.createdAt); if (b.status === "confirmed") c._s.push(b);
  }
  const clients = Object.values(CL).map(c => { const s = c._s.sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1)), past = s.filter(b => b.checkIn <= today), fav = {};
    s.forEach(b => (fav[b.unitId] = (fav[b.unitId] || 0) + 1)); const f = Object.entries(fav).sort((a, b) => b[1] - a[1])[0];
    return { key: c.key, name: c.name, phone: c.phone, email: c.email, bookings: c.bookings, stays: s.length, nights: sum(s, b => b.nights), spent: sum(s, b => b.total), avgSpend: s.length ? Math.round(sum(s, b => b.total) / s.length) : 0,
      first: s[0]?.checkIn || null, last: past.length ? past[past.length - 1].checkIn : null, next: s.find(b => b.checkIn > today)?.checkIn || null,
      favourite: f ? units.find(u => u.id === f[0])?.name : "", segment: s.length >= 2 ? "Returning" : s.length === 1 ? "First-time" : "Enquiry only", lastBooked: c.lastBooked };
  }).sort((a, b) => b.spent - a.spent);
  const seen = new Set(), nr = {};
  for (const b of [...conf].sort((a, c) => (a.checkIn < c.checkIn ? -1 : 1))) { const k = digits(b.phone) || b.name.toLowerCase(), m = mkey(b.checkIn), isRet = seen.has(k); seen.add(k);
    if (b.checkIn >= from && b.checkIn <= to) { const e = nr[m] || (nr[m] = { month: m, new: 0, returning: 0 }); e[isRet ? "returning" : "new"]++; } }
  const withStay = clients.filter(c => c.stays > 0);
  const clientSummary = { total: withStay.length, returning: withStay.filter(c => c.stays > 1).length, repeatRate: pct(withStay.filter(c => c.stays > 1).length, withStay.length),
    avgSpend: withStay.length ? Math.round(sum(withStay, c => c.spent) / withStay.length) : 0, avgStays: withStay.length ? Math.round(sum(withStay, c => c.stays) / withStay.length * 10) / 10 : 0,
    top: withStay.slice(0, 5), newVsReturning: Object.values(nr).sort((a, b) => (a.month < b.month ? -1 : 1)) };

  // ---- operations
  const brief = b => ({ ref: b.ref, unit: units.find(u => u.id === b.unitId)?.name, name: b.name, phone: b.phone, guests: b.guests, checkIn: b.checkIn, checkOut: b.checkOut, notes: b.notes });
  const ops = { inHouse: conf.filter(b => b.checkIn <= today && b.checkOut > today).map(brief), arrivals: conf.filter(b => b.checkIn >= today && b.checkIn <= addDays(today, 13)).sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1)).map(brief),
    departures: conf.filter(b => b.checkOut >= today && b.checkOut <= addDays(today, 13)).sort((a, b) => (a.checkOut < b.checkOut ? -1 : 1)).map(brief),
    maintenance: db.blocks.filter(x => x.to >= today).sort((a, b) => (a.from < b.from ? -1 : 1)).map(x => ({ ...x, unit: units.find(u => u.id === x.unitId)?.name, days: nightsOf(x.from, x.to) + 1 })) };

  return { from, to, today, totals: { revenue, nights, available, occupancy: Math.min(100, pct(nights, available)), adr: nights ? Math.round(revenue / nights) : 0, revpar: available ? Math.round(revenue / available) : 0,
      bookings: inP.length, guests: sum(inP, b => b.guests), avgStay: inP.length ? Math.round(sum(inP, b => b.nights) / inP.length * 10) / 10 : 0, avgValue: inP.length ? Math.round(sum(inP, b => b.total) / inP.length) : 0 },
    months, byUnit, leadTime, stayLength, weekday, source, funnel, pipeline, clients, clientSummary, ops };
}
module.exports = { build, digits };
