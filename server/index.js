
import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// ======================================================
// EWALEL COTTAGES - COMPLETE BACKEND
// ======================================================

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 20) {
  throw new Error("Set JWT_SECRET (20+ characters) in server/.env");
}

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
}));
app.use(express.json({ limit: "100kb" }));

// ======================================================
// MYSQL DATABASE
// ======================================================

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "ewalel_designed",
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

const asyncRoute = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function auth(req, res, next) {
  const token = (req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "");

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({
      error: "Administrator sign-in required"
    });
  }
}

function positive(v) {
  return v !== null &&
    v !== "" &&
    Number.isFinite(Number(v)) &&
    Number(v) > 0;
}

function validId(v) {
  return /^[1-9]\d*$/.test(String(v || ""));
}

function validDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return false;
  const date = new Date(v + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === v;
}

// ======================================================
// PHOTO STORAGE
// ======================================================

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(
  process.env.UPLOAD_DIR || path.join(serverDir, "uploads")
);
const cottageUploadDir = path.join(uploadDir, "cottages");

await fs.mkdir(cottageUploadDir, { recursive: true });

app.use("/uploads", express.static(uploadDir, {
  index: false,
  dotfiles: "deny",
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=3600");
  }
}));

const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 5 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    if (!["image/jpeg", "image/png", "image/webp"]
      .includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG and WebP images are allowed"));
    }
    cb(null, true);
  }
}).array("photos", 10);

function photoUrl(filename) {
  return `/uploads/cottages/${filename}`;
}

async function removePhotoFile(url) {
  const filename = path.basename(url || "");
  if (!/^[a-f0-9-]{36}\.webp$/.test(filename)) return;

  await fs.unlink(path.join(cottageUploadDir, filename))
    .catch(err => {
      if (err.code !== "ENOENT") throw err;
    });
}

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", asyncRoute(async (req, res) => {
  await query("SELECT 1");
  res.json({ ok: true, database: "connected" });
}));

// ======================================================
// ADMIN LOGIN
// ======================================================

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};

  const rows = await query(
    "SELECT * FROM admins WHERE email=?",
    [email || ""]
  );

  if (!rows.length ||
      !await bcrypt.compare(password || "", rows[0].password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: rows[0].id, email: rows[0].email },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token });
}));

// ======================================================
// PUBLIC COTTAGES
// ======================================================

app.get("/api/cottages", asyncRoute(async (req, res) => {
  res.json(await query(
    "SELECT * FROM cottages WHERE active=1 ORDER BY id DESC"
  ));
}));

// ======================================================
// ADMIN COTTAGES
// ======================================================

app.get("/api/admin/cottages", auth, asyncRoute(async (req, res) => {
  res.json(await query("SELECT * FROM cottages ORDER BY id DESC"));
}));

app.post("/api/admin/cottages", auth, asyncRoute(async (req, res) => {
  const {
    name,
    location,
    description = "",
    nightly_rate,
    capacity = 2,
    photo_url = ""
  } = req.body || {};

  if (!name?.trim() || !location?.trim() ||
      !positive(nightly_rate) || !positive(capacity) ||
      !Number.isInteger(Number(capacity))) {
    return res.status(400).json({
      error: "Valid name, location, rate and capacity are required"
    });
  }

  const result = await query(
    `INSERT INTO cottages
     (name, location, description, nightly_rate, capacity, photo_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      location.trim(),
      description,
      Number(nightly_rate),
      Number(capacity),
      photo_url
    ]
  );

  res.status(201).json({ id: result.insertId, ok: true });
}));

// EDIT COTTAGE

async function updateCottage(req, res) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid cottage ID" });
  }

  const allowed = [
    "name", "location", "description",
    "nightly_rate", "capacity", "photo_url", "active"
  ];

  const body = req.body || {};
  const keys = Object.keys(body).filter(k => allowed.includes(k));

  if (!keys.length) {
    return res.status(400).json({ error: "No editable fields" });
  }

  if (keys.includes("name") && !String(body.name || "").trim()) {
    return res.status(400).json({ error: "Name required" });
  }

  if (keys.includes("location") && !String(body.location || "").trim()) {
    return res.status(400).json({ error: "Location required" });
  }

  if (keys.includes("nightly_rate") && !positive(body.nightly_rate)) {
    return res.status(400).json({ error: "Invalid nightly rate" });
  }

  if (keys.includes("capacity") &&
      (!positive(body.capacity) ||
       !Number.isInteger(Number(body.capacity)))) {
    return res.status(400).json({ error: "Invalid capacity" });
  }

  if (keys.includes("active") &&
      ![0, 1, true, false].includes(body.active)) {
    return res.status(400).json({ error: "Invalid active status" });
  }

  const result = await query(
    `UPDATE cottages SET ${keys.map(k => `${k}=?`).join(", ")}
     WHERE id=?`,
    [...keys.map(k => body[k]), req.params.id]
  );

  if (!result.affectedRows) {
    return res.status(404).json({ error: "Cottage not found" });
  }

  res.json({ ok: true });
}

app.patch("/api/admin/cottages/:id", auth, asyncRoute(updateCottage));
app.put("/api/admin/cottages/:id", auth, asyncRoute(updateCottage));

// ARCHIVE COTTAGE

app.delete("/api/admin/cottages/:id", auth, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid cottage ID" });
  }

  const result = await query(
    "UPDATE cottages SET active=0 WHERE id=?",
    [req.params.id]
  );

  if (!result.affectedRows) {
    return res.status(404).json({ error: "Cottage not found" });
  }

  res.json({ ok: true, message: "Cottage archived" });
}));

// ======================================================
// COTTAGE PHOTOS - PUBLIC GALLERY
// ======================================================

app.get("/api/cottages/:id/photos", asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid cottage ID" });
  }

  const cottages = await query(
    "SELECT id FROM cottages WHERE id=? AND active=1",
    [req.params.id]
  );

  if (!cottages.length) {
    return res.status(404).json({ error: "Cottage not found" });
  }

  res.json(await query(
    `SELECT id, cottage_id, photo_url, is_cover, created_at
     FROM cottage_photos WHERE cottage_id=?
     ORDER BY is_cover DESC, id ASC`,
    [req.params.id]
  ));
}));

// ======================================================
// ADMIN PHOTO GALLERY
// ======================================================

app.get(
  "/api/admin/cottages/:id/photos",
  auth,
  asyncRoute(async (req, res) => {
    if (!validId(req.params.id)) {
      return res.status(400).json({ error: "Invalid cottage ID" });
    }

    res.json(await query(
      `SELECT * FROM cottage_photos
       WHERE cottage_id=?
       ORDER BY is_cover DESC, id ASC`,
      [req.params.id]
    ));
  })
);

// ======================================================
// UPLOAD PHOTOS FROM DEVICE
// ======================================================

app.post(
  "/api/admin/cottages/:id/photos",
  auth,
  (req, res, next) => uploadPhotos(req, res, next),
  asyncRoute(async (req, res) => {
    const cottageId = req.params.id;

    if (!validId(cottageId)) {
      return res.status(400).json({ error: "Invalid cottage ID" });
    }

    const cottages = await query(
      "SELECT id FROM cottages WHERE id=?",
      [cottageId]
    );

    if (!cottages.length) {
      return res.status(404).json({ error: "Cottage not found" });
    }

    if (!req.files?.length) {
      return res.status(400).json({
        error: "Please select photographs"
      });
    }

    const savedFiles = [];
    let committed = false;

    try {
      for (const file of req.files) {
        const image = sharp(file.buffer, {
          limitInputPixels: 25000000
        });

        const metadata = await image.metadata();

        if (!["jpeg", "png", "webp"].includes(metadata.format)) {
          throw new Error("Invalid image format");
        }

        const filename = `${crypto.randomUUID()}.webp`;

        const buffer = await image
          .rotate()
          .resize({
            width: 1800,
            height: 1800,
            fit: "inside",
            withoutEnlargement: true
          })
          .webp({ quality: 85 })
          .toBuffer();

        await fs.writeFile(
          path.join(cottageUploadDir, filename),
          buffer,
          { flag: "wx" }
        );

        savedFiles.push(photoUrl(filename));
      }

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        const [cottageRows] = await conn.execute(
          "SELECT photo_url FROM cottages WHERE id=? FOR UPDATE",
          [cottageId]
        );

        if (!cottageRows.length) {
          throw new Error("Cottage no longer exists");
        }

        const [existing] = await conn.execute(
          "SELECT id FROM cottage_photos WHERE cottage_id=? LIMIT 1",
          [cottageId]
        );

        const makeCover =
          existing.length === 0 && !cottageRows[0].photo_url;

        for (let i = 0; i < savedFiles.length; i++) {
          await conn.execute(
            `INSERT INTO cottage_photos
             (cottage_id, photo_url, is_cover)
             VALUES (?, ?, ?)`,
            [cottageId, savedFiles[i], makeCover && i === 0 ? 1 : 0]
          );
        }

        if (makeCover) {
          await conn.execute(
            "UPDATE cottages SET photo_url=? WHERE id=?",
            [savedFiles[0], cottageId]
          );
        }

        await conn.commit();
        committed = true;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      const photos = await query(
        `SELECT * FROM cottage_photos WHERE cottage_id=?
         ORDER BY is_cover DESC, id ASC`,
        [cottageId]
      );

      res.status(201).json({
        ok: true,
        uploaded: savedFiles.length,
        photos
      });

    } catch (err) {
      if (!committed) {
        await Promise.allSettled(savedFiles.map(removePhotoFile));
      }
      throw err;
    }
  })
);

// ======================================================
// SET COVER PHOTO
// ======================================================

app.patch(
  "/api/admin/cottages/:id/photos/:photoId/cover",
  auth,
  asyncRoute(async (req, res) => {
    const { id, photoId } = req.params;

    if (!validId(id) || !validId(photoId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [cottages] = await conn.execute(
        "SELECT id FROM cottages WHERE id=? FOR UPDATE",
        [id]
      );

      if (!cottages.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Cottage not found" });
      }

      const [photos] = await conn.execute(
        `SELECT photo_url FROM cottage_photos
         WHERE id=? AND cottage_id=?`,
        [photoId, id]
      );

      if (!photos.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Photo not found" });
      }

      await conn.execute(
        "UPDATE cottage_photos SET is_cover=0 WHERE cottage_id=?",
        [id]
      );

      await conn.execute(
        `UPDATE cottage_photos SET is_cover=1
         WHERE id=? AND cottage_id=?`,
        [photoId, id]
      );

      await conn.execute(
        "UPDATE cottages SET photo_url=? WHERE id=?",
        [photos[0].photo_url, id]
      );

      await conn.commit();

      res.json({
        ok: true,
        photo_url: photos[0].photo_url
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// ======================================================
// DELETE PHOTO
// ======================================================

app.delete(
  "/api/admin/cottages/:id/photos/:photoId",
  auth,
  asyncRoute(async (req, res) => {
    const { id, photoId } = req.params;

    if (!validId(id) || !validId(photoId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    let deletedUrl;
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [cottages] = await conn.execute(
        "SELECT photo_url FROM cottages WHERE id=? FOR UPDATE",
        [id]
      );

      if (!cottages.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Cottage not found" });
      }

      const [photos] = await conn.execute(
        `SELECT * FROM cottage_photos
         WHERE id=? AND cottage_id=?`,
        [photoId, id]
      );

      if (!photos.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Photo not found" });
      }

      deletedUrl = photos[0].photo_url;

      await conn.execute(
        "DELETE FROM cottage_photos WHERE id=? AND cottage_id=?",
        [photoId, id]
      );

      const [remaining] = await conn.execute(
        `SELECT id, photo_url FROM cottage_photos
         WHERE cottage_id=?
         ORDER BY is_cover DESC, id ASC LIMIT 1`,
        [id]
      );

      if (
        photos[0].is_cover ||
        cottages[0].photo_url === deletedUrl
      ) {
        await conn.execute(
          "UPDATE cottage_photos SET is_cover=0 WHERE cottage_id=?",
          [id]
        );

        if (remaining.length) {
          await conn.execute(
            "UPDATE cottage_photos SET is_cover=1 WHERE id=?",
            [remaining[0].id]
          );
        }

        await conn.execute(
          "UPDATE cottages SET photo_url=? WHERE id=?",
          [remaining[0]?.photo_url || "", id]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    try {
      await removePhotoFile(deletedUrl);
    } catch (err) {
      console.error("Photo file cleanup failed:", err);
    }

    res.json({ ok: true });
  })
);

// ======================================================
// MAINTENANCE
// ======================================================

app.get("/api/admin/maintenance", auth, asyncRoute(async (req, res) => {
  res.json(await query(
    `SELECT m.*, c.name AS cottage_name
     FROM maintenance m
     JOIN cottages c ON c.id=m.cottage_id
     ORDER BY m.scheduled_date DESC, m.id DESC`
  ));
}));

app.post("/api/admin/maintenance", auth, asyncRoute(async (req, res) => {
  const {
    cottage_id,
    task,
    scheduled_date,
    assigned_to = "",
    estimated_cost = 0,
    notes = ""
  } = req.body || {};

  if (!validId(cottage_id) || !task?.trim() ||
      !validDate(scheduled_date) ||
      !Number.isFinite(Number(estimated_cost)) ||
      Number(estimated_cost) < 0) {
    return res.status(400).json({
      error: "Valid cottage, task, date and cost required"
    });
  }

  const result = await query(
    `INSERT INTO maintenance
     (cottage_id, task, scheduled_date, assigned_to, estimated_cost, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      cottage_id,
      task.trim(),
      scheduled_date,
      assigned_to,
      Number(estimated_cost),
      notes
    ]
  );

  res.status(201).json({ id: result.insertId });
}));

app.patch(
  "/api/admin/maintenance/:id",
  auth,
  asyncRoute(async (req, res) => {
    const { status, actual_cost } = req.body || {};

    if (!["scheduled", "in_progress", "completed", "cancelled"]
      .includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (actual_cost != null &&
        (!Number.isFinite(Number(actual_cost)) ||
         Number(actual_cost) < 0)) {
      return res.status(400).json({ error: "Invalid cost" });
    }

    await query(
      `UPDATE maintenance
       SET status=?,
           actual_cost=COALESCE(?,actual_cost),
           completed_at=CASE
             WHEN ?='completed'
             THEN COALESCE(completed_at,NOW())
             ELSE NULL
           END
       WHERE id=?`,
      [
        status,
        actual_cost == null ? null : Number(actual_cost),
        status,
        req.params.id
      ]
    );

    res.json({ ok: true });
  })
);

// ======================================================
// BOOKINGS
// ======================================================

app.post("/api/bookings", asyncRoute(async (req, res) => {
  const {
    cottage_id,
    guest_name,
    guest_email,
    guest_phone = "",
    check_in,
    check_out,
    guests
  } = req.body || {};

  if (!validId(cottage_id) ||
      !validDate(check_in) || !validDate(check_out)) {
    return res.status(400).json({ error: "Invalid booking dates" });
  }

  const nights = Math.round(
    (Date.parse(check_out + "T12:00:00Z") -
     Date.parse(check_in + "T12:00:00Z")) / 86400000
  );

  if (!guest_name?.trim() ||
      !guest_email?.includes("@") ||
      !Number.isInteger(nights) ||
      nights < 1 ||
      check_in < new Date().toISOString().slice(0, 10) ||
      !positive(guests) ||
      !Number.isInteger(Number(guests))) {
    return res.status(400).json({
      error: "Invalid booking details"
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [cottages] = await conn.execute(
      "SELECT * FROM cottages WHERE id=? FOR UPDATE",
      [cottage_id]
    );

    const cottage = cottages[0];

    if (!cottage || !cottage.active ||
        Number(guests) > cottage.capacity) {
      await conn.rollback();
      return res.status(400).json({
        error: "Cottage unavailable or capacity exceeded"
      });
    }

    const [conflicts] = await conn.execute(
      `SELECT id FROM bookings
       WHERE cottage_id=?
       AND status NOT IN ('cancelled')
       AND check_in < ?
       AND check_out > ?
       LIMIT 1`,
      [cottage_id, check_out, check_in]
    );

    const [repairs] = await conn.execute(
      `SELECT id FROM maintenance
       WHERE cottage_id=?
       AND status IN ('scheduled','in_progress')
       AND scheduled_date >= ?
       AND scheduled_date < ?
       LIMIT 1`,
      [cottage_id, check_in, check_out]
    );

    if (conflicts.length || repairs.length) {
      await conn.rollback();
      return res.status(409).json({
        error: "Cottage unavailable for these dates"
      });
    }

    const total = nights * Number(cottage.nightly_rate);

    const [result] = await conn.execute(
      `INSERT INTO bookings
       (cottage_id, guest_name, guest_email, guest_phone,
        check_in, check_out, guests, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cottage_id,
        guest_name.trim(),
        guest_email.trim(),
        guest_phone,
        check_in,
        check_out,
        Number(guests),
        total
      ]
    );

    await conn.commit();

    res.status(201).json({
      id: result.insertId,
      total,
      status: "pending"
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.get("/api/admin/bookings", auth, asyncRoute(async (req, res) => {
  res.json(await query(
    `SELECT b.*, c.name AS cottage_name
     FROM bookings b
     JOIN cottages c ON c.id=b.cottage_id
     ORDER BY b.created_at DESC`
  ));
}));

app.patch(
  "/api/admin/bookings/:id",
  auth,
  asyncRoute(async (req, res) => {
    if (!["pending", "confirmed", "cancelled",
          "checked_in", "checked_out"].includes(req.body?.status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await query(
      "UPDATE bookings SET status=? WHERE id=?",
      [req.body.status, req.params.id]
    );

    res.json({ ok: true });
  })
);

// ======================================================
// PAYMENTS
// ======================================================

app.get("/api/admin/payments", auth, asyncRoute(async (req, res) => {
  res.json(await query(
    `SELECT p.*, b.guest_name
     FROM payments p
     JOIN bookings b ON b.id=p.booking_id
     ORDER BY p.id DESC`
  ));
}));

app.post("/api/admin/payments", auth, asyncRoute(async (req, res) => {
  const {
    booking_id,
    method,
    amount,
    reference,
    status = "pending"
  } = req.body || {};

  if (!validId(booking_id) ||
      !["mpesa", "card", "cash"].includes(method) ||
      !positive(amount) ||
      !["pending", "completed"].includes(status)) {
    return res.status(400).json({ error: "Invalid payment" });
  }

  const bookings = await query(
    "SELECT id FROM bookings WHERE id=?",
    [booking_id]
  );

  if (!bookings.length) {
    return res.status(404).json({ error: "Booking not found" });
  }

  if (status === "completed" && !reference?.trim()) {
    return res.status(400).json({
      error: "Completed payments require a receipt/reference"
    });
  }

  const result = await query(
    `INSERT INTO payments
     (booking_id, method, amount, reference, status, paid_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      booking_id,
      method,
      Number(amount),
      reference || null,
      status,
      status === "completed" ? new Date() : null
    ]
  );

  res.status(201).json({ id: result.insertId });
}));

// ======================================================
// FINANCE
// ======================================================

app.get("/api/admin/finance", auth, asyncRoute(async (req, res) => {
  const [revenueRows, methods, bookings] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(amount),0) AS total
       FROM payments WHERE status='completed'`
    ),
    query(
      `SELECT method, COALESCE(SUM(amount),0) AS amount
       FROM payments WHERE status='completed'
       GROUP BY method`
    ),
    query(
      `SELECT b.id, b.total_amount,
       COALESCE(SUM(
         CASE WHEN p.status='completed' THEN p.amount ELSE 0 END
       ),0) AS paid
       FROM bookings b
       LEFT JOIN payments p ON p.booking_id=b.id
       WHERE b.status!='cancelled'
       GROUP BY b.id,b.total_amount`
    )
  ]);

  const outstanding = bookings.reduce(
    (sum, b) => sum + Math.max(
      0,
      Number(b.total_amount) - Number(b.paid)
    ),
    0
  );

  res.json({
    revenue: revenueRows[0]?.total || 0,
    outstanding,
    methods
  });
}));

// ======================================================
// ERROR HANDLING
// ======================================================

app.use((req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  if (
    err.message === "Invalid image format" ||
    err.message?.startsWith("Only JPG") ||
    err.message?.includes("Input buffer contains unsupported")
  ) {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "Duplicate reference" });
  }

  res.status(500).json({
    error: "Server error; check server logs"
  });
});

// ======================================================
// START SERVER
// ======================================================

try {
  await pool.query("SELECT 1");
  console.log("MySQL connected");
} catch (err) {
  console.error("MySQL connection failed:", err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Ewalel API running on port ${PORT}`);
});
