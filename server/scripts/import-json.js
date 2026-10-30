// Copies bookings, prices and photos from the old JSON file into MySQL: npm run import-json [path/to/db.json]
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs"), path = require("path"), db = require("../db");
(async () => {
  const file = process.argv[2] || path.join(__dirname, "..", "data", "db.json");
  if (!fs.existsSync(file)) { console.error("File not found: " + file); process.exit(1); }
  await db.init({ seed: false });                           // creates the tables only; your file provides the data
  await db.importData(JSON.parse(fs.readFileSync(file, "utf8")));
  const d = await db.load();
  console.log(`Done. Database now has ${d.units.length} units, ${d.bookings.length} bookings, ${d.blocks.length} maintenance blocks, ${d.mpesa.length} M-Pesa payments.`);
  await db.close();
})().catch(e => { console.error("Import failed:", e.message); process.exit(1); });
