// Excel workbooks for the owner. Real dates, number formats, filters and SUM formulas, so they are ready to work with in Excel.
const ExcelJS = require("exceljs");
const { digits } = require("./analytics");
const D = s => (s ? new Date(s + "T00:00:00Z") : null), T = ms => (ms ? new Date(ms) : null);
const DATE = "dd mmm yyyy", KES = "#,##0";

function sheet(wb, name, cols, rows, totals = []) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map(c => ({ header: c.h, key: c.k, width: c.w || 14, style: c.f ? { numFmt: c.f } : {} }));
  rows.forEach(r => ws.addRow(r));
  ws.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8441F" } }; });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  if (totals.length && rows.length) {
    const t = ws.addRow({ [cols[0].k]: "Total" });
    for (const k of totals) { const L = ws.getColumn(k).letter; t.getCell(k).value = { formula: `SUM(${L}2:${L}${rows.length + 1})`, result: rows.reduce((a, r) => a + (+r[k] || 0), 0) }; }
    t.font = { bold: true };
  }
  return ws;
}
const unitName = (db, id) => db.units.find(u => u.id === id)?.name || id;

const sheets = {
  clients: (wb, db, A) => sheet(wb, "Clients", [
    { h: "Name", k: "name", w: 24 }, { h: "Phone", k: "phone", w: 16 }, { h: "Email", k: "email", w: 28 }, { h: "Segment", k: "segment", w: 14 }, { h: "Confirmed stays", k: "stays" }, { h: "Nights", k: "nights" },
    { h: "Total spent (KES)", k: "spent", w: 16, f: KES }, { h: "Average per stay (KES)", k: "avgSpend", w: 20, f: KES }, { h: "First stay", k: "first", f: DATE }, { h: "Last stay", k: "last", f: DATE },
    { h: "Next stay", k: "next", f: DATE }, { h: "Favourite penthouse", k: "favourite", w: 20 }, { h: "Last booked on", k: "lastBooked", f: DATE }],
    A.clients.map(c => ({ ...c, first: D(c.first), last: D(c.last), next: D(c.next), lastBooked: T(c.lastBooked) })), ["stays", "nights", "spent"]),
  bookings: (wb, db, A) => sheet(wb, "Bookings", [
    { h: "Booking code", k: "ref" }, { h: "Status", k: "status", w: 18 }, { h: "Penthouse", k: "unit", w: 18 }, { h: "Guest", k: "name", w: 22 }, { h: "Phone", k: "phone", w: 16 }, { h: "Email", k: "email", w: 26 },
    { h: "Guests", k: "guests" }, { h: "Check in", k: "checkIn", f: DATE }, { h: "Check out", k: "checkOut", f: DATE }, { h: "Nights", k: "nights" }, { h: "Total (KES)", k: "total", f: KES }, { h: "Deposit (KES)", k: "deposit", f: KES },
    { h: "Balance (KES)", k: "balance", f: KES }, { h: "M-Pesa receipt", k: "receipt", w: 16 }, { h: "Source", k: "source" }, { h: "Booked on", k: "createdAt", f: DATE }, { h: "Notes", k: "notes", w: 30 }],
    db.bookings.filter(b => b.checkIn <= A.to && b.checkOut >= A.from).sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1))
      .map(b => ({ ...b, unit: unitName(db, b.unitId), status: { confirmed: "Confirmed", payment_submitted: "Verify payment", awaiting_payment: "Awaiting payment", cancelled: "Cancelled" }[b.status], balance: Math.max(0, b.total - b.deposit),
        source: b.source === "web" ? "Website" : "Owner", checkIn: D(b.checkIn), checkOut: D(b.checkOut), createdAt: T(b.createdAt) })), ["guests", "nights", "total", "deposit", "balance"]),
  payments: (wb, db) => sheet(wb, "M-Pesa payments", [
    { h: "Receipt", k: "receipt", w: 16 }, { h: "Booking code", k: "ref" }, { h: "Guest", k: "name", w: 22 }, { h: "Phone", k: "phone", w: 16 }, { h: "Deposit due (KES)", k: "due", f: KES, w: 18 }, { h: "Amount received (KES)", k: "got", f: KES, w: 20 },
    { h: "Verification", k: "how", w: 30 }, { h: "Booking status", k: "status", w: 18 }],
    db.bookings.filter(b => b.receipt).map(b => { const tx = db.mpesa.find(t => t.transId === b.receipt);
      return { receipt: b.receipt, ref: b.ref, name: b.name, phone: b.phone, due: b.deposit, got: tx ? tx.amount : null, status: b.status,
        how: tx ? "Matched to M-Pesa records" : b.status === "confirmed" ? "Verified manually by owner" : "Awaiting verification" }; }), ["due", "got"]),
  revenue: (wb, db, A) => sheet(wb, "Revenue and occupancy", [{ h: "Month", k: "month" }, ...db.units.map(u => ({ h: u.name + " revenue (KES)", k: "r_" + u.id, f: KES, w: 24 })),
    { h: "Total revenue (KES)", k: "revenue", f: KES, w: 20 }, { h: "Nights sold", k: "nights" }, { h: "Nights available", k: "available", w: 16 }, { h: "Occupancy %", k: "occupancy" }, { h: "Avg daily rate (KES)", k: "adr", f: KES, w: 20 }, { h: "Revenue per available night (KES)", k: "revpar", f: KES, w: 30 }],
    A.months.map(m => ({ ...m, ...Object.fromEntries(db.units.map(u => ["r_" + u.id, m.byUnit[u.id].revenue])) })), [...db.units.map(u => "r_" + u.id), "revenue", "nights", "available"]),
  maintenance: (wb, db) => sheet(wb, "Maintenance", [{ h: "Penthouse", k: "unit", w: 18 }, { h: "From", k: "from", f: DATE }, { h: "To", k: "to", f: DATE }, { h: "Days", k: "days" }, { h: "Reason", k: "reason", w: 40 }],
    [...db.blocks].sort((a, b) => (a.from < b.from ? -1 : 1)).map(x => ({ unit: unitName(db, x.unitId), from: D(x.from), to: D(x.to), days: Math.round((Date.parse(x.to) - Date.parse(x.from)) / 864e5) + 1, reason: x.reason })), ["days"]),
  summary: (wb, db, A) => {
    const t = A.totals, f = A.funnel, c = A.clientSummary, rows = [["Period", `${A.from} to ${A.to}`], ["Revenue (KES)", t.revenue], ["Nights sold", t.nights], ["Occupancy %", t.occupancy], ["Average daily rate (KES)", t.adr],
      ["Revenue per available night (KES)", t.revpar], ["Bookings (check-ins in period)", t.bookings], ["Guests", t.guests], ["Average stay (nights)", t.avgStay], ["Average booking value (KES)", t.avgValue],
      ["Website requests", f.requests], ["Confirmed", f.confirmed], ["Conversion %", f.conversion], ["Upcoming confirmed value (KES)", A.pipeline.upcoming.value], ["Balance due on arrival (KES)", A.pipeline.balanceDue],
      ["Clients with a stay", c.total], ["Returning clients", c.returning], ["Repeat rate %", c.repeatRate], ["Average spend per client (KES)", c.avgSpend]];
    const ws = sheet(wb, "Summary", [{ h: "Measure", k: "a", w: 42 }, { h: "Value", k: "b", w: 26 }], rows.map(([a, b]) => ({ a, b })));
    ws.getColumn("b").alignment = { horizontal: "right" }; return ws;
  }
};

async function workbook(kind, db, A) {
  const wb = new ExcelJS.Workbook(); wb.creator = "Ewalel Cottages"; wb.created = new Date();
  if (kind === "report") { for (const k of ["summary", "revenue", "bookings", "clients", "payments", "maintenance"]) sheets[k](wb, db, A); return wb; }
  if (!sheets[kind]) return null;
  sheets[kind](wb, db, A); return wb;
}
module.exports = { workbook };
