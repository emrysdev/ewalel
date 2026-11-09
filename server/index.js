
// import "dotenv/config";
// import express from "express";
// import cors from "cors";
// import mysql from "mysql2/promise";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import multer from "multer";
// import sharp from "sharp";
// import fs from "node:fs/promises";
// import path from "node:path";
// import crypto from "node:crypto";
// import { fileURLToPath } from "node:url";
// import helmet from "helmet";
// import rateLimit from "express-rate-limit";



// // ======================================================
// // EWALEL COTTAGES - COMPLETE BACKEND
// // ======================================================




// const app = express();
// // Security headers
// app.disable("x-powered-by");

// app.use(
//   helmet({
//     contentSecurityPolicy: false
//   })
// );

// // General API rate limiting
// const apiLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 150,
//   standardHeaders: "draft-8",
//   legacyHeaders: false,
//   message: {
//     error: "Too many requests. Please try again later."
//   }
// });

// app.use("/api", apiLimiter);

// // Stricter login protection
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 5,
//   standardHeaders: "draft-8",
//   legacyHeaders: false,
//   message: {
//     error: "Too many login attempts. Try again in 15 minutes."
//   }
// });

// app.use("/api/auth/login", loginLimiter);

// const PORT = Number(process.env.PORT || 4000);
// const JWT_SECRET = process.env.JWT_SECRET;

// if (!JWT_SECRET || JWT_SECRET.length < 20) {
//   throw new Error("Set JWT_SECRET (20+ characters) in server/.env");
// }
// // React frontend production build
// const __dirname = path.dirname(fileURLToPath(import.meta.url));

// const clientDist = path.resolve(
//   __dirname,
//   "../client/dist"
// );

// app.use(cors({
//   origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
// }));
// app.use(express.json({ limit: "100kb" }));

// // ======================================================
// // MYSQL DATABASE
// // ======================================================

// const pool = mysql.createPool({
//   host: process.env.DB_HOST || "127.0.0.1",
//   port: Number(process.env.DB_PORT || 3306),
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME || "ewalel_designed",
//   waitForConnections: true,
//   connectionLimit: 10,
//   decimalNumbers: true
// });

// async function query(sql, params = []) {
//   const [rows] = await pool.execute(sql, params);
//   return rows;
// }

// const asyncRoute = fn => (req, res, next) =>
//   Promise.resolve(fn(req, res, next)).catch(next);

// function auth(req, res, next) {
//   const token = (req.headers.authorization || "")
//     .replace(/^Bearer\s+/i, "");

//   try {
//     req.admin = jwt.verify(token, JWT_SECRET);
//     next();
//   } catch {
//     res.status(401).json({
//       error: "Administrator sign-in required"
//     });
//   }
// }

// function positive(v) {
//   return v !== null &&
//     v !== "" &&
//     Number.isFinite(Number(v)) &&
//     Number(v) > 0;
// }

// function validId(v) {
//   return /^[1-9]\d*$/.test(String(v || ""));
// }

// function validDate(v) {
//   if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return false;
//   const date = new Date(v + "T12:00:00Z");
//   return !Number.isNaN(date.getTime()) &&
//     date.toISOString().slice(0, 10) === v;
// }

// // ======================================================
// // PHOTO STORAGE
// // ======================================================

// const serverDir = path.dirname(fileURLToPath(import.meta.url));
// const uploadDir = path.resolve(
//   process.env.UPLOAD_DIR || path.join(serverDir, "uploads")
// );
// const cottageUploadDir = path.join(uploadDir, "cottages");

// await fs.mkdir(cottageUploadDir, { recursive: true });

// app.use("/uploads", express.static(uploadDir, {
//   index: false,
//   dotfiles: "deny",
//   setHeaders(res) {
//     res.setHeader("X-Content-Type-Options", "nosniff");
//     res.setHeader("Cache-Control", "public, max-age=3600");
//   }
// }));

// const uploadPhotos = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     files: 10,
//     fileSize: 5 * 1024 * 1024
//   },
//   fileFilter(req, file, cb) {
//     if (!["image/jpeg", "image/png", "image/webp"]
//       .includes(file.mimetype)) {
//       return cb(new Error("Only JPG, PNG and WebP images are allowed"));
//     }
//     cb(null, true);
//   }
// }).array("photos", 10);

// function photoUrl(filename) {
//   return `/uploads/cottages/${filename}`;
// }

// async function removePhotoFile(url) {
//   const filename = path.basename(url || "");
//   if (!/^[a-f0-9-]{36}\.webp$/.test(filename)) return;

//   await fs.unlink(path.join(cottageUploadDir, filename))
//     .catch(err => {
//       if (err.code !== "ENOENT") throw err;
//     });
// }

// // ======================================================
// // HEALTH CHECK
// // ======================================================

// app.get("/api/health", asyncRoute(async (req, res) => {
//   await query("SELECT 1");
//   res.json({ ok: true, database: "connected" });
// }));

// // ======================================================
// // ADMIN LOGIN
// // ======================================================

// app.post("/api/auth/login", asyncRoute(async (req, res) => {
//   const { email, password } = req.body || {};

//   const rows = await query(
//     "SELECT * FROM admins WHERE email=?",
//     [email || ""]
//   );

//   if (!rows.length ||
//       !await bcrypt.compare(password || "", rows[0].password_hash)) {
//     return res.status(401).json({ error: "Invalid credentials" });
//   }

//   const token = jwt.sign(
//     { id: rows[0].id, email: rows[0].email },
//     JWT_SECRET,
//     { expiresIn: "8h" }
//   );

//   res.json({ token });
// }));

// // ======================================================
// // PUBLIC COTTAGES
// // ======================================================

// app.get("/api/cottages", asyncRoute(async (req, res) => {
//   res.json(await query(
//     "SELECT * FROM cottages WHERE active=1 ORDER BY id DESC"
//   ));
// }));

// // ======================================================
// // ADMIN COTTAGES
// // ======================================================

// app.get("/api/admin/cottages", auth, asyncRoute(async (req, res) => {
//   res.json(await query("SELECT * FROM cottages ORDER BY id DESC"));
// }));

// app.post("/api/admin/cottages", auth, asyncRoute(async (req, res) => {
//   const {
//     name,
//     location,
//     description = "",
//     nightly_rate,
//     capacity = 2,
//     photo_url = ""
//   } = req.body || {};

//   if (!name?.trim() || !location?.trim() ||
//       !positive(nightly_rate) || !positive(capacity) ||
//       !Number.isInteger(Number(capacity))) {
//     return res.status(400).json({
//       error: "Valid name, location, rate and capacity are required"
//     });
//   }

//   const result = await query(
//     `INSERT INTO cottages
//      (name, location, description, nightly_rate, capacity, photo_url)
//      VALUES (?, ?, ?, ?, ?, ?)`,
//     [
//       name.trim(),
//       location.trim(),
//       description,
//       Number(nightly_rate),
//       Number(capacity),
//       photo_url
//     ]
//   );

//   res.status(201).json({ id: result.insertId, ok: true });
// }));

// // EDIT COTTAGE

// async function updateCottage(req, res) {
//   if (!validId(req.params.id)) {
//     return res.status(400).json({ error: "Invalid cottage ID" });
//   }

//   const allowed = [
//     "name", "location", "description",
//     "nightly_rate", "capacity", "photo_url", "active"
//   ];

//   const body = req.body || {};
//   const keys = Object.keys(body).filter(k => allowed.includes(k));

//   if (!keys.length) {
//     return res.status(400).json({ error: "No editable fields" });
//   }

//   if (keys.includes("name") && !String(body.name || "").trim()) {
//     return res.status(400).json({ error: "Name required" });
//   }

//   if (keys.includes("location") && !String(body.location || "").trim()) {
//     return res.status(400).json({ error: "Location required" });
//   }

//   if (keys.includes("nightly_rate") && !positive(body.nightly_rate)) {
//     return res.status(400).json({ error: "Invalid nightly rate" });
//   }

//   if (keys.includes("capacity") &&
//       (!positive(body.capacity) ||
//        !Number.isInteger(Number(body.capacity)))) {
//     return res.status(400).json({ error: "Invalid capacity" });
//   }

//   if (keys.includes("active") &&
//       ![0, 1, true, false].includes(body.active)) {
//     return res.status(400).json({ error: "Invalid active status" });
//   }

//   const result = await query(
//     `UPDATE cottages SET ${keys.map(k => `${k}=?`).join(", ")}
//      WHERE id=?`,
//     [...keys.map(k => body[k]), req.params.id]
//   );

//   if (!result.affectedRows) {
//     return res.status(404).json({ error: "Cottage not found" });
//   }

//   res.json({ ok: true });
// }

// app.patch("/api/admin/cottages/:id", auth, asyncRoute(updateCottage));
// app.put("/api/admin/cottages/:id", auth, asyncRoute(updateCottage));

// // ARCHIVE COTTAGE

// app.delete("/api/admin/cottages/:id", auth, asyncRoute(async (req, res) => {
//   if (!validId(req.params.id)) {
//     return res.status(400).json({ error: "Invalid cottage ID" });
//   }

//   const result = await query(
//     "UPDATE cottages SET active=0 WHERE id=?",
//     [req.params.id]
//   );

//   if (!result.affectedRows) {
//     return res.status(404).json({ error: "Cottage not found" });
//   }

//   res.json({ ok: true, message: "Cottage archived" });
// }));

// // ======================================================
// // COTTAGE PHOTOS - PUBLIC GALLERY
// // ======================================================

// app.get("/api/cottages/:id/photos", asyncRoute(async (req, res) => {
//   if (!validId(req.params.id)) {
//     return res.status(400).json({ error: "Invalid cottage ID" });
//   }

//   const cottages = await query(
//     "SELECT id FROM cottages WHERE id=? AND active=1",
//     [req.params.id]
//   );

//   if (!cottages.length) {
//     return res.status(404).json({ error: "Cottage not found" });
//   }

//   res.json(await query(
//     `SELECT id, cottage_id, photo_url, is_cover, created_at
//      FROM cottage_photos WHERE cottage_id=?
//      ORDER BY is_cover DESC, id ASC`,
//     [req.params.id]
//   ));
// }));

// // ======================================================
// // ADMIN PHOTO GALLERY
// // ======================================================

// app.get(
//   "/api/admin/cottages/:id/photos",
//   auth,
//   asyncRoute(async (req, res) => {
//     if (!validId(req.params.id)) {
//       return res.status(400).json({ error: "Invalid cottage ID" });
//     }

//     res.json(await query(
//       `SELECT * FROM cottage_photos
//        WHERE cottage_id=?
//        ORDER BY is_cover DESC, id ASC`,
//       [req.params.id]
//     ));
//   })
// );

// // ======================================================
// // UPLOAD PHOTOS FROM DEVICE
// // ======================================================

// app.post(
//   "/api/admin/cottages/:id/photos",
//   auth,
//   (req, res, next) => uploadPhotos(req, res, next),
//   asyncRoute(async (req, res) => {
//     const cottageId = req.params.id;

//     if (!validId(cottageId)) {
//       return res.status(400).json({ error: "Invalid cottage ID" });
//     }

//     const cottages = await query(
//       "SELECT id FROM cottages WHERE id=?",
//       [cottageId]
//     );

//     if (!cottages.length) {
//       return res.status(404).json({ error: "Cottage not found" });
//     }

//     if (!req.files?.length) {
//       return res.status(400).json({
//         error: "Please select photographs"
//       });
//     }

//     const savedFiles = [];
//     let committed = false;

//     try {
//       for (const file of req.files) {
//         const image = sharp(file.buffer, {
//           limitInputPixels: 25000000
//         });

//         const metadata = await image.metadata();

//         if (!["jpeg", "png", "webp"].includes(metadata.format)) {
//           throw new Error("Invalid image format");
//         }

//         const filename = `${crypto.randomUUID()}.webp`;

//         const buffer = await image
//           .rotate()
//           .resize({
//             width: 1800,
//             height: 1800,
//             fit: "inside",
//             withoutEnlargement: true
//           })
//           .webp({ quality: 85 })
//           .toBuffer();

//         await fs.writeFile(
//           path.join(cottageUploadDir, filename),
//           buffer,
//           { flag: "wx" }
//         );

//         savedFiles.push(photoUrl(filename));
//       }

//       const conn = await pool.getConnection();

//       try {
//         await conn.beginTransaction();

//         const [cottageRows] = await conn.execute(
//           "SELECT photo_url FROM cottages WHERE id=? FOR UPDATE",
//           [cottageId]
//         );

//         if (!cottageRows.length) {
//           throw new Error("Cottage no longer exists");
//         }

//         const [existing] = await conn.execute(
//           "SELECT id FROM cottage_photos WHERE cottage_id=? LIMIT 1",
//           [cottageId]
//         );

//         const makeCover =
//           existing.length === 0 && !cottageRows[0].photo_url;

//         for (let i = 0; i < savedFiles.length; i++) {
//           await conn.execute(
//             `INSERT INTO cottage_photos
//              (cottage_id, photo_url, is_cover)
//              VALUES (?, ?, ?)`,
//             [cottageId, savedFiles[i], makeCover && i === 0 ? 1 : 0]
//           );
//         }

//         if (makeCover) {
//           await conn.execute(
//             "UPDATE cottages SET photo_url=? WHERE id=?",
//             [savedFiles[0], cottageId]
//           );
//         }

//         await conn.commit();
//         committed = true;
//       } catch (err) {
//         await conn.rollback();
//         throw err;
//       } finally {
//         conn.release();
//       }

//       const photos = await query(
//         `SELECT * FROM cottage_photos WHERE cottage_id=?
//          ORDER BY is_cover DESC, id ASC`,
//         [cottageId]
//       );

//       res.status(201).json({
//         ok: true,
//         uploaded: savedFiles.length,
//         photos
//       });

//     } catch (err) {
//       if (!committed) {
//         await Promise.allSettled(savedFiles.map(removePhotoFile));
//       }
//       throw err;
//     }
//   })
// );

// // ======================================================
// // SET COVER PHOTO
// // ======================================================

// app.patch(
//   "/api/admin/cottages/:id/photos/:photoId/cover",
//   auth,
//   asyncRoute(async (req, res) => {
//     const { id, photoId } = req.params;

//     if (!validId(id) || !validId(photoId)) {
//       return res.status(400).json({ error: "Invalid ID" });
//     }

//     const conn = await pool.getConnection();

//     try {
//       await conn.beginTransaction();

//       const [cottages] = await conn.execute(
//         "SELECT id FROM cottages WHERE id=? FOR UPDATE",
//         [id]
//       );

//       if (!cottages.length) {
//         await conn.rollback();
//         return res.status(404).json({ error: "Cottage not found" });
//       }

//       const [photos] = await conn.execute(
//         `SELECT photo_url FROM cottage_photos
//          WHERE id=? AND cottage_id=?`,
//         [photoId, id]
//       );

//       if (!photos.length) {
//         await conn.rollback();
//         return res.status(404).json({ error: "Photo not found" });
//       }

//       await conn.execute(
//         "UPDATE cottage_photos SET is_cover=0 WHERE cottage_id=?",
//         [id]
//       );

//       await conn.execute(
//         `UPDATE cottage_photos SET is_cover=1
//          WHERE id=? AND cottage_id=?`,
//         [photoId, id]
//       );

//       await conn.execute(
//         "UPDATE cottages SET photo_url=? WHERE id=?",
//         [photos[0].photo_url, id]
//       );

//       await conn.commit();

//       res.json({
//         ok: true,
//         photo_url: photos[0].photo_url
//       });
//     } catch (err) {
//       await conn.rollback();
//       throw err;
//     } finally {
//       conn.release();
//     }
//   })
// );

// // ======================================================
// // DELETE PHOTO
// // ======================================================

// app.delete(
//   "/api/admin/cottages/:id/photos/:photoId",
//   auth,
//   asyncRoute(async (req, res) => {
//     const { id, photoId } = req.params;

//     if (!validId(id) || !validId(photoId)) {
//       return res.status(400).json({ error: "Invalid ID" });
//     }

//     let deletedUrl;
//     const conn = await pool.getConnection();

//     try {
//       await conn.beginTransaction();

//       const [cottages] = await conn.execute(
//         "SELECT photo_url FROM cottages WHERE id=? FOR UPDATE",
//         [id]
//       );

//       if (!cottages.length) {
//         await conn.rollback();
//         return res.status(404).json({ error: "Cottage not found" });
//       }

//       const [photos] = await conn.execute(
//         `SELECT * FROM cottage_photos
//          WHERE id=? AND cottage_id=?`,
//         [photoId, id]
//       );

//       if (!photos.length) {
//         await conn.rollback();
//         return res.status(404).json({ error: "Photo not found" });
//       }

//       deletedUrl = photos[0].photo_url;

//       await conn.execute(
//         "DELETE FROM cottage_photos WHERE id=? AND cottage_id=?",
//         [photoId, id]
//       );

//       const [remaining] = await conn.execute(
//         `SELECT id, photo_url FROM cottage_photos
//          WHERE cottage_id=?
//          ORDER BY is_cover DESC, id ASC LIMIT 1`,
//         [id]
//       );

//       if (
//         photos[0].is_cover ||
//         cottages[0].photo_url === deletedUrl
//       ) {
//         await conn.execute(
//           "UPDATE cottage_photos SET is_cover=0 WHERE cottage_id=?",
//           [id]
//         );

//         if (remaining.length) {
//           await conn.execute(
//             "UPDATE cottage_photos SET is_cover=1 WHERE id=?",
//             [remaining[0].id]
//           );
//         }

//         await conn.execute(
//           "UPDATE cottages SET photo_url=? WHERE id=?",
//           [remaining[0]?.photo_url || "", id]
//         );
//       }

//       await conn.commit();
//     } catch (err) {
//       await conn.rollback();
//       throw err;
//     } finally {
//       conn.release();
//     }

//     try {
//       await removePhotoFile(deletedUrl);
//     } catch (err) {
//       console.error("Photo file cleanup failed:", err);
//     }

//     res.json({ ok: true });
//   })
// );

// // ======================================================
// // MAINTENANCE
// // ======================================================

// // app.get("/api/admin/maintenance", auth, asyncRoute(async (req, res) => {
// //   const maintenance = await query(`
// //     SELECT
// //       m.*,
// //       u.name AS cottage_name
// //     FROM maintenance m
// //     JOIN units u ON u.id = m.cottage_id
// //     ORDER BY m.scheduled_date DESC, m.id DESC
// //   `);
// app.get("/api/admin/maintenance", auth, asyncRoute(async (req, res) => {
//   res.json(await query(`
//     SELECT
//       m.*,
//       u.name AS cottage_name
//     FROM maintenance m
//     JOIN units u ON u.id = m.cottage_id
//     ORDER BY m.scheduled_date DESC, m.id DESC
//   `));

//   res.json(maintenance);
// }));

// app.post("/api/admin/maintenance", auth, asyncRoute(async (req, res) => {
//   const {
//     cottage_id,
//     task,
//     scheduled_date,
//     assigned_to = "",
//     estimated_cost = 0,
//     notes = ""
//   } = req.body || {};

//   if (!validId(cottage_id) || !task?.trim() ||
//       !validDate(scheduled_date) ||
//       !Number.isFinite(Number(estimated_cost)) ||
//       Number(estimated_cost) < 0) {
//     return res.status(400).json({
//       error: "Valid cottage, task, date and cost required"
//     });
//   }

//   const result = await query(
//     `INSERT INTO maintenance
//      (cottage_id, task, scheduled_date, assigned_to, estimated_cost, notes)
//      VALUES (?, ?, ?, ?, ?, ?)`,
//     [
//       cottage_id,
//       task.trim(),
//       scheduled_date,
//       assigned_to,
//       Number(estimated_cost),
//       notes
//     ]
//   );

//   res.status(201).json({ id: result.insertId });
// }));

// app.patch(
//   "/api/admin/maintenance/:id",
//   auth,
//   asyncRoute(async (req, res) => {
//     const { status, actual_cost } = req.body || {};

//     if (!["scheduled", "in_progress", "completed", "cancelled"]
//       .includes(status)) {
//       return res.status(400).json({ error: "Invalid status" });
//     }

//     if (actual_cost != null &&
//         (!Number.isFinite(Number(actual_cost)) ||
//          Number(actual_cost) < 0)) {
//       return res.status(400).json({ error: "Invalid cost" });
//     }

//     await query(
//       `UPDATE maintenance
//        SET status=?,
//            actual_cost=COALESCE(?,actual_cost),
//            completed_at=CASE
//              WHEN ?='completed'
//              THEN COALESCE(completed_at,NOW())
//              ELSE NULL
//            END
//        WHERE id=?`,
//       [
//         status,
//         actual_cost == null ? null : Number(actual_cost),
//         status,
//         req.params.id
//       ]
//     );

//     res.json({ ok: true });
//   })
// );

// // ======================================================
// // BOOKINGS
// // ======================================================

// app.post("/api/bookings", asyncRoute(async (req, res) => {
//   const {
//     cottage_id,
//     guest_name,
//     guest_email,
//     guest_phone = "",
//     check_in,
//     check_out,
//     guests
//   } = req.body || {};

//   if (!validId(cottage_id) ||
//       !validDate(check_in) || !validDate(check_out)) {
//     return res.status(400).json({ error: "Invalid booking dates" });
//   }

//   const nights = Math.round(
//     (Date.parse(check_out + "T12:00:00Z") -
//      Date.parse(check_in + "T12:00:00Z")) / 86400000
//   );

//   if (!guest_name?.trim() ||
//       !guest_email?.includes("@") ||
//       !Number.isInteger(nights) ||
//       nights < 1 ||
//       check_in < new Date().toISOString().slice(0, 10) ||
//       !positive(guests) ||
//       !Number.isInteger(Number(guests))) {
//     return res.status(400).json({
//       error: "Invalid booking details"
//     });
//   }

//   const conn = await pool.getConnection();

//   try {
//     await conn.beginTransaction();

//     const [cottages] = await conn.execute(
//       "SELECT * FROM cottages WHERE id=? FOR UPDATE",
//       [cottage_id]
//     );

//     const cottage = cottages[0];

//     if (!cottage || !cottage.active ||
//         Number(guests) > cottage.capacity) {
//       await conn.rollback();
//       return res.status(400).json({
//         error: "Cottage unavailable or capacity exceeded"
//       });
//     }

//     const [conflicts] = await conn.execute(
//       `SELECT id FROM bookings
//        WHERE cottage_id=?
//        AND status NOT IN ('cancelled')
//        AND check_in < ?
//        AND check_out > ?
//        LIMIT 1`,
//       [cottage_id, check_out, check_in]
//     );

//     const [repairs] = await conn.execute(
//       `SELECT id FROM maintenance
//        WHERE cottage_id=?
//        AND status IN ('scheduled','in_progress')
//        AND scheduled_date >= ?
//        AND scheduled_date < ?
//        LIMIT 1`,
//       [cottage_id, check_in, check_out]
//     );

//     if (conflicts.length || repairs.length) {
//       await conn.rollback();
//       return res.status(409).json({
//         error: "Cottage unavailable for these dates"
//       });
//     }

//     const total = nights * Number(cottage.nightly_rate);

//     const [result] = await conn.execute(
//       `INSERT INTO bookings
//        (cottage_id, guest_name, guest_email, guest_phone,
//         check_in, check_out, guests, total_amount)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         cottage_id,
//         guest_name.trim(),
//         guest_email.trim(),
//         guest_phone,
//         check_in,
//         check_out,
//         Number(guests),
//         total
//       ]
//     );

//     await conn.commit();

//     res.status(201).json({
//       id: result.insertId,
//       total,
//       status: "pending"
//     });
//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// }));

// app.get("/api/admin/bookings", auth, asyncRoute(async (req, res) => {
//   res.json(await query(`
//     SELECT
//       b.*,
//       u.name AS cottage_name
//     FROM bookings b
//     JOIN units u ON u.id = b.cottage_id
//     ORDER BY b.created_at DESC
//   `));
// }));

// app.patch(
//   "/api/admin/bookings/:id",
//   auth,
//   asyncRoute(async (req, res) => {
//     if (!["pending", "confirmed", "cancelled",
//           "checked_in", "checked_out"].includes(req.body?.status)) {
//       return res.status(400).json({ error: "Invalid status" });
//     }

//     await query(
//       "UPDATE bookings SET status=? WHERE id=?",
//       [req.body.status, req.params.id]
//     );

//     res.json({ ok: true });
//   })
// );

// // ======================================================
// // PAYMENTS
// // ======================================================

// // app.get("/api/admin/payments", auth, asyncRoute(async (req, res) => {
// //   res.json(await query(
// //     `SELECT p.*, b.guest_name
// //      FROM payments p
// //      JOIN bookings b ON b.id=p.booking_id
// //      ORDER BY p.id DESC`
// //   ));
// // }));
// app.get("/api/admin/payments", auth, asyncRoute(async (req, res) => {
//   const payments = await query(`
//     SELECT
//       id,
//       booking_id,
//       payment_method,
//       amount,
//       transaction_reference,
//       status,
//       paid_at,
//       created_at
//     FROM payments
//     ORDER BY id DESC
//   `);

//   res.json(payments);
// }));

// app.post("/api/admin/payments", auth, asyncRoute(async (req, res) => {
//   const {
//     booking_id,
//     method,
//     amount,
//     reference,
//     status = "pending"
//   } = req.body || {};

//   if (!validId(booking_id) ||
//       !["mpesa", "card", "cash"].includes(method) ||
//       !positive(amount) ||
//       !["pending", "completed"].includes(status)) {
//     return res.status(400).json({ error: "Invalid payment" });
//   }

//   const bookings = await query(
//     "SELECT id FROM bookings WHERE id=?",
//     [booking_id]
//   );

//   if (!bookings.length) {
//     return res.status(404).json({ error: "Booking not found" });
//   }

//   if (status === "completed" && !reference?.trim()) {
//     return res.status(400).json({
//       error: "Completed payments require a receipt/reference"
//     });
//   }

//   const result = await query(
//     `INSERT INTO payments
//      (booking_id, method, amount, reference, status, paid_at)
//      VALUES (?, ?, ?, ?, ?, ?)`,
//     [
//       booking_id,
//       method,
//       Number(amount),
//       reference || null,
//       status,
//       status === "completed" ? new Date() : null
//     ]
//   );

//   res.status(201).json({ id: result.insertId });
// }));

// // ======================================================
// // FINANCE
// // ======================================================

// app.get("/api/admin/finance", auth, asyncRoute(async (req, res) => {
//   const [revenueRows, methods, bookings] = await Promise.all([
//     query(
//       `SELECT COALESCE(SUM(amount),0) AS total
//        FROM payments WHERE status='completed'`
//     ),
//     query(
//       `SELECT method, COALESCE(SUM(amount),0) AS amount
//        FROM payments WHERE status='completed'
//        GROUP BY method`
//     ),
//     query(
//       `SELECT b.id, b.total_amount,
//        COALESCE(SUM(
//          CASE WHEN p.status='completed' THEN p.amount ELSE 0 END
//        ),0) AS paid
//        FROM bookings b
//        LEFT JOIN payments p ON p.booking_id=b.id
//        WHERE b.status!='cancelled'
//        GROUP BY b.id,b.total_amount`
//     )
//   ]);

//   const outstanding = bookings.reduce(
//     (sum, b) => sum + Math.max(
//       0,
//       Number(b.total_amount) - Number(b.paid)
//     ),
//     0
//   );

//   res.json({
//     revenue: revenueRows[0]?.total || 0,
//     outstanding,
//     methods
//   });
// }));

// // ======================================================
// // SERVE EWALEL REACT FRONTEND
// // ======================================================

// // Serve compiled React assets
// app.use(express.static(clientDist));

// // Serve React pages and support browser refreshes
// app.use((req, res, next) => {
//   // Keep API requests separate from frontend routes
//   if (req.path.startsWith("/api/")) {
//     return next();
//   }

//   // Only serve the React app for page requests
//   if (req.method !== "GET" && req.method !== "HEAD") {
//     return next();
//   }

//   // Missing static files should not return the React page
//   if (path.extname(req.path)) {
//     return next();
//   }

//   res.sendFile(path.join(clientDist, "index.html"), err => {
//     if (err) next(err);
//   });
// });

// // ======================================================
// // ERROR HANDLING
// // ======================================================
// // ======================================================
// // SERVE EWALEL REACT FRONTEND
// // ======================================================

// const frontendPath = path.resolve(
//   path.dirname(fileURLToPath(import.meta.url)),
//   "../client/dist"
// );

// // Serve React files
// app.use(express.static(frontendPath));

// // React frontend routes
// app.use((req, res, next) => {
//   if (
//     req.method !== "GET" ||
//     req.path.startsWith("/api/") ||
//     req.path.startsWith("/uploads/") ||
//     path.extname(req.path)
//   ) {
//     return next();
//   }

//   res.sendFile(
//     path.join(frontendPath, "index.html"),
//     err => {
//       if (err) next(err);
//     }
//   );
// });
// app.use((req, res) => {
//   res.status(404).json({ error: "API endpoint not found" });
// });

// app.use((err, req, res, next) => {
//   console.error(err);

//   if (err instanceof multer.MulterError) {
//     return res.status(400).json({ error: err.message });
//   }

//   if (
//     err.message === "Invalid image format" ||
//     err.message?.startsWith("Only JPG") ||
//     err.message?.includes("Input buffer contains unsupported")
//   ) {
//     return res.status(400).json({ error: err.message });
//   }

//   if (err.code === "ER_DUP_ENTRY") {
//     return res.status(409).json({ error: "Duplicate reference" });
//   }

//   res.status(500).json({
//     error: "Server error; check server logs"
//   });
// });

// // ======================================================
// // START SERVER
// // ======================================================

// try {
//   await pool.query("SELECT 1");
//   console.log("MySQL connected");
// } catch (err) {
//   console.error("MySQL connection failed:", err.message);
//   process.exit(1);
// }

// app.listen(PORT, () => {
//   console.log(`Ewalel API running on port ${PORT}`);
// });



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
import helmet from "helmet";
import rateLimit from "express-rate-limit";



// ======================================================
// EWALEL COTTAGES - COMPLETE BACKEND
// ======================================================




const app = express();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Serve uploaded cottage photographs


// const UPLOADS_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
//   ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "uploads")
//   : path.join(
//       path.dirname(fileURLToPath(import.meta.url)),
//       "uploads"
//     );

// // Serve uploaded photographs
// app.use("/uploads", express.static(UPLOADS_DIR));



// Security headers
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 100 : 2000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later."
  }
});

// app.use("/api", apiLimiter);
// Apply the general API rate limiter in production only
if (process.env.NODE_ENV === "production") {
  app.use("/api", apiLimiter);
}

// Stricter login protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Try again in 15 minutes."
  }
});

app.use("/api/auth/login", loginLimiter);

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 20) {
  throw new Error("Set JWT_SECRET (20+ characters) in server/.env");
}
// React frontend production build
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const clientDist = path.resolve(
  __dirname,
  "../client/dist"
);

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
// TEMPORARY: Check backend database connection
app.get("/api/debug/database", asyncRoute(async (req, res) => {

  const database = await query(
    "SELECT DATABASE() AS db, @@hostname AS host, @@port AS port"
  );

  const columns = await query(
    "SHOW COLUMNS FROM cottages"
  );

  const cottages = await query(
    "SELECT * FROM cottages LIMIT 10"
  );

  res.json({
    database: database[0],
    columns,
    cottages
  });

}));

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

// function validId(v) {
//   return /^[1-9]\d*$/.test(String(v || ""));
// }
function validId(v) {
  return typeof v === "string" &&
    /^[a-zA-Z0-9_-]{1,20}$/.test(v);
}

function validCottageId(v) {
  return /^[a-zA-Z0-9_-]{1,20}$/.test(String(v || ""));
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
  process.env.UPLOAD_DIR ||
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "uploads")
    : path.join(serverDir, "uploads"))
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
  const cottages = await query(`
    SELECT
      id,
      name,
      location,
      price,
      price AS nightly_rate,
      cap,
      cap AS capacity,
      blurb,
      blurb AS description,
      beds,
      photo_url,
      active
    FROM cottages
    WHERE active = 1
    ORDER BY sort_order ASC, name ASC
  `);

  res.json(cottages);
}));


// ======================================================
// ADMIN COTTAGES
// ======================================================


app.get("/api/admin/cottages", auth, asyncRoute(async (req, res) => {
  const cottages = await query(`
    SELECT
      *,
      price AS nightly_rate,
      cap AS capacity,
      blurb AS description
    FROM cottages
    ORDER BY sort_order ASC, name ASC
  `);

  res.json(cottages);
}));


// app.post("/api/admin/cottages", auth, asyncRoute(async (req, res) => {
//   const {
//     name,
//     location,
//     description = "",
//     nightly_rate,
//     capacity = 2,
//     photo_url = ""
//   } = req.body || {};

//   if (!name?.trim() || !location?.trim() ||
//       !positive(nightly_rate) || !positive(capacity) ||
//       !Number.isInteger(Number(capacity))) {
//     return res.status(400).json({
//       error: "Valid name, location, rate and capacity are required"
//     });
//   }

//   const result = await query(
//     `INSERT INTO cottages
//      (name, location, description, nightly_rate, capacity, photo_url)
//      VALUES (?, ?, ?, ?, ?, ?)`,
//     [
//       name.trim(),
//       location.trim(),
//       description,
//       Number(nightly_rate),
//       Number(capacity),
//       photo_url
//     ]
//   );

//   res.status(201).json({ id: result.insertId, ok: true });
// }));

app.post("/api/admin/cottages", auth, asyncRoute(async (req, res) => {
  const {
    name,
    location,
    description = "",
    nightly_rate,
    capacity = 2,
    photo_url = ""
  } = req.body || {};

  const price = Number(nightly_rate);
  const cap = Number(capacity);

  if (
    !name?.trim() ||
    !location?.trim() ||
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    !Number.isSafeInteger(cap) ||
    cap <= 0
  ) {
    return res.status(400).json({
      error: "Valid name, location, rate and capacity are required"
    });
  }

  const id = "C" + crypto.randomBytes(8).toString("hex");

  await query(
    `INSERT INTO cottages
      (id, name, price, cap, beds, blurb,
       sort_order, location, active, photo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name.trim(),
      price,
      cap,
      "",
      description,
      0,
      location.trim(),
      1,
      photo_url
    ]
  );

  res.status(201).json({
    id,
    ok: true
  });
}));


// EDIT COTTAGE


async function updateCottage(req, res) {
  const cottageId = String(req.params.id || "");

  if (!/^[a-zA-Z0-9_-]{1,20}$/.test(cottageId)) {
    return res.status(400).json({
      error: "Invalid cottage ID"
    });
  }

  // Map frontend fields to actual MySQL columns
  const fieldMap = {
    name: "name",
    location: "location",
    description: "blurb",
    nightly_rate: "price",
    capacity: "cap",
    photo_url: "photo_url",
    active: "active"
  };

  const body = req.body || {};

  const keys = Object.keys(body).filter(
    key => Object.hasOwn(fieldMap, key)
  );

  if (!keys.length) {
    return res.status(400).json({
      error: "No editable fields"
    });
  }

  if (keys.includes("name") &&
      !String(body.name || "").trim()) {
    return res.status(400).json({
      error: "Name required"
    });
  }

  if (keys.includes("location") &&
      !String(body.location || "").trim()) {
    return res.status(400).json({
      error: "Location required"
    });
  }

  if (keys.includes("nightly_rate") &&
      !positive(body.nightly_rate)) {
    return res.status(400).json({
      error: "Invalid nightly rate"
    });
  }

  if (keys.includes("capacity") &&
      (!positive(body.capacity) ||
       !Number.isInteger(Number(body.capacity)))) {
    return res.status(400).json({
      error: "Invalid capacity"
    });
  }

  if (keys.includes("active") &&
      ![0, 1, true, false].includes(body.active)) {
    return res.status(400).json({
      error: "Invalid active status"
    });
  }

  const updates = keys.map(
    key => `${fieldMap[key]} = ?`
  ).join(", ");

  const values = keys.map(key => {
    if (key === "nightly_rate" ||
        key === "capacity") {
      return Number(body[key]);
    }

    if (key === "active") {
      return Number(body[key]);
    }

    return body[key];
  });

  const result = await query(
    `UPDATE cottages SET ${updates} WHERE id = ?`,
    [...values, cottageId]
  );

  if (!result.affectedRows) {
    return res.status(404).json({
      error: "Cottage not found"
    });
  }

  res.json({
    ok: true,
    message: "Cottage updated successfully"
  });
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
  const maintenance = await query(`
    SELECT m.*, c.name AS cottage_name
    FROM maintenance m
    JOIN cottages c ON c.id = m.cottage_id
    ORDER BY m.scheduled_date DESC, m.id DESC
  `);
  res.json(maintenance);
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

// ======================================================
// PUBLIC BOOKINGS
// ======================================================

app.post("/api/bookings", asyncRoute(async (req, res) => {
  const {
    cottage_id,
    guest_name,
    guest_email,
    guest_phone,
    check_in,
    check_out,
    guests,
    notes = ""
  } = req.body || {};

  const cottageId = String(cottage_id || "").trim();
  const name = String(guest_name || "").trim();
  const email = String(guest_email || "").trim();
  const phone = String(guest_phone || "").trim();

  if (
    !validCottageId(cottageId) ||
    !validDate(check_in) ||
    !validDate(check_out) ||
    !name ||
    name.length > 80 ||
    !email.includes("@") ||
    email.length > 100 ||
    !phone ||
    phone.length > 20 ||
    !Number.isInteger(Number(guests)) ||
    Number(guests) < 1
  ) {
    return res.status(400).json({
      error: "Please provide valid booking details"
    });
  }

  const nights = Math.round(
    (
      Date.parse(check_out + "T12:00:00Z") -
      Date.parse(check_in + "T12:00:00Z")
    ) / 86400000
  );

  if (
    nights < 1 ||
    check_in < new Date().toISOString().slice(0, 10)
  ) {
    return res.status(400).json({
      error: "Please select valid booking dates"
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [cottages] = await conn.execute(
      "SELECT * FROM cottages WHERE id = ? FOR UPDATE",
      [cottageId]
    );

    const cottage = cottages[0];

  console.log("BOOKING DEBUG:", {
  cottageId,
  cottageFound: !!cottage,
  active: cottage?.active,
  capacity: cottage?.cap,
  guests: Number(guests)
});
    if (
      !cottage ||
      !cottage.active ||
      Number(guests) > Number(cottage.cap)
    ) {
      await conn.rollback();

      return res.status(400).json({
        error: "Cottage unavailable or capacity exceeded"
      });
    }

    const [conflicts] = await conn.execute(
      `SELECT id
       FROM bookings
       WHERE unit_id = ?
       AND status <> 'cancelled'
       AND check_in < ?
       AND check_out > ?
       LIMIT 1`,
      [cottageId, check_out, check_in]
    );

    if (conflicts.length) {
      await conn.rollback();

      return res.status(409).json({
        error: "Cottage is already booked for these dates"
      });
    }

    const total = nights * Number(cottage.price);

    const bookingId =
      "B" + crypto.randomBytes(8).toString("hex");

    const bookingRef =
      "EW" + crypto.randomBytes(5).toString("hex").toUpperCase();

    await conn.execute(
      `INSERT INTO bookings (
        id,
        ref,
        unit_id,
        check_in,
        check_out,
        nights,
        guests,
        name,
        phone,
        email,
        notes,
        total,
        deposit,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingId,
        bookingRef,
        cottageId,
        check_in,
        check_out,
        nights,
        Number(guests),
        name,
        phone,
        email,
        String(notes || "").slice(0, 300),
        total,
        0,
        Date.now()
      ]
    );

    await conn.commit();

    res.status(201).json({
      ok: true,
      id: bookingId,
      ref: bookingRef,
      total,
      nights,
      status: "awaiting_payment",
      message: "Booking created. Please complete payment."
    });

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.get("/api/admin/bookings", auth, asyncRoute(async (req, res) => {
  const bookings = await query(`
    SELECT
      b.*,
      c.name AS cottage_name
    FROM bookings b
    LEFT JOIN cottages c ON c.id = b.unit_id
    ORDER BY b.created_at DESC
  `);

  res.json(bookings);
}));

// 


app.patch(
  "/api/admin/bookings/:id",
  auth,
  asyncRoute(async (req, res) => {

    const allowedStatuses = [
      "awaiting_payment",
      "payment_submitted",
      "confirmed",
      "cancelled"
    ];

    const status = req.body?.status;

    // Validate booking status
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid booking status"
      });
    }

    // Prevent manual confirmation without payment verification
    if (status === "confirmed") {
      return res.status(403).json({
        error: "Confirm bookings through the payment verification process"
      });
    }

    // Validate booking ID
    const bookingId = String(req.params.id || "");

    if (!validId(bookingId)) {
      return res.status(400).json({
        error: "Invalid booking ID"
      });
    }

    // Prevent changing an already confirmed booking through this route
    const result = await query(
      `UPDATE bookings
       SET status = ?
       WHERE id = ?
       AND status IN ('awaiting_payment', 'payment_submitted')`,
      [status, bookingId]
    );

    if (!result.affectedRows) {
      return res.status(409).json({
        error: "Booking not found or status change not permitted"
      });
    }

    res.json({
      ok: true,
      booking_id: bookingId,
      status
    });

  })
);


// ======================================================
// PAYMENTS
// ======================================================

// app.get("/api/admin/payments", auth, asyncRoute(async (req, res) => {
//   res.json(await query(
//     `SELECT p.*, b.guest_name
//      FROM payments p
//      JOIN bookings b ON b.id=p.booking_id
//      ORDER BY p.id DESC`
//   ));
// }));
// app.get("/api/admin/payments", auth, asyncRoute(async (req, res) => {
//   const payments = await query(`
//     SELECT
//       id,
//       booking_id,
//       payment_method,
//       amount,
//       transaction_reference,
//       status,
//       paid_at,
//       created_at
//     FROM payments
//     ORDER BY id DESC
//   `);

//   res.json(payments);
// }));

app.get("/api/admin/payments", auth, asyncRoute(async (req, res) => {
  const payments = await query(`
    SELECT
      p.*,
      p.payment_method AS method,
      p.transaction_reference AS reference,
      b.name AS guest_name
    FROM payments p
    LEFT JOIN bookings b ON b.id = p.booking_id
    ORDER BY p.id DESC
  `);

  res.json(payments);
}));

// app.post("/api/admin/payments", auth, asyncRoute(async (req, res) => {
//   const {
//     booking_id,
//     method,
//     amount,
//     reference,
//     status = "pending"
//   } = req.body || {};

//   if (!validId(booking_id) ||
//       !["mpesa", "card", "cash"].includes(method) ||
//       !positive(amount) ||
//       !["pending", "completed"].includes(status)) {
//     return res.status(400).json({ error: "Invalid payment" });
//   }

//   const bookings = await query(
//     "SELECT id FROM bookings WHERE id=?",
//     [booking_id]
//   );

//   if (!bookings.length) {
//     return res.status(404).json({ error: "Booking not found" });
//   }

//   if (status === "completed" && !reference?.trim()) {
//     return res.status(400).json({
//       error: "Completed payments require a receipt/reference"
//     });
//   }

//   // Submit M-PESA receipt for admin verification
// app.post("/api/mpesa/submit-receipt", asyncRoute(async (req, res) => {
//   const { booking_id, receipt_number } = req.body || {};

//   const bookingId = String(booking_id || "").trim();
//   const receipt = String(receipt_number || "").trim().toUpperCase();

//   if (!bookingId || !/^[A-Z0-9]{8,20}$/.test(receipt)) {
//     return res.status(400).json({
//       error: "Valid booking ID and M-PESA receipt number are required"
//     });
//   }

//   // Check that the booking exists
//   const bookings = await query(
//     "SELECT id FROM bookings WHERE id = ? LIMIT 1",
//     [bookingId]
//   );

//   if (!bookings.length) {
//     return res.status(404).json({
//       error: "Booking not found"
//     });
//   }

//   // Check whether the receipt has already been submitted
//   const existing = await query(
//     "SELECT trans_id FROM mpesa_payments WHERE receipt_number = ? LIMIT 1",
//     [receipt]
//   );

//   if (existing.length) {
//     return res.status(409).json({
//       error: "This M-PESA receipt has already been submitted"
//     });
//   }

//   // Save receipt as pending, NOT verified
//   const transactionId = `MAN-${Date.now()}`;

//   await query(
//     `INSERT INTO mpesa_payments
//       (trans_id, amount, account, receipt_number,
//        booking_id, status, payment_source, received_at)
//      VALUES (?, ?, ?, ?, ?, 'pending', 'manual', ?)`,
//     [
//       transactionId,
//       0,
//       "7845616",
//       receipt,
//       bookingId,
//       Date.now()
//     ]
//   );

//   res.status(201).json({
//     ok: true,
//     message: "Receipt submitted. Awaiting admin verification.",
//     status: "pending"
//   });
// }));

// ADMIN: Record a payment
app.post("/api/admin/payments", auth, asyncRoute(async (req, res) => {
  const {
    booking_id,
    method,
    amount,
    reference,
    status = "pending"
  } = req.body || {};

  const bookingId = String(booking_id || "");

  if (
    !validId(bookingId) ||
    !["mpesa", "card", "cash"].includes(method) ||
    !positive(amount) ||
    !["pending", "completed"].includes(status)
  ) {
    return res.status(400).json({ error: "Invalid payment details" });
  }

  const bookings = await query(
    "SELECT id FROM bookings WHERE id = ?",
    [bookingId]
  );

  if (!bookings.length) {
    return res.status(404).json({ error: "Booking not found" });
  }

  if (status === "completed" && !String(reference || "").trim()) {
    return res.status(400).json({
      error: "Completed payments require a transaction reference"
    });
  }

  // Manual M-PESA receipts must be verified separately.
  if (method === "mpesa" && status === "completed") {
    return res.status(400).json({
      error: "Verify the M-PESA receipt before recording payment"
    });
  }

  const result = await query(
    `INSERT INTO payments
      (booking_id, payment_method, amount,
       transaction_reference, status, paid_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      bookingId,
      method,
      Number(amount),
      reference || null,
      status,
      status === "completed" ? new Date() : null
    ]
  );

  res.status(201).json({
    ok: true,
    id: result.insertId
  });
}));

// GUEST: Submit M-PESA receipt for admin review

app.post("/api/mpesa/submit-receipt", asyncRoute(async (req, res) => {
  const bookingId = String(req.body?.booking_id || "").trim();
  const receipt = String(req.body?.receipt_number || "")
    .trim()
    .toUpperCase();

  if (!bookingId || !/^[A-Z0-9]{8,20}$/.test(receipt)) {
    return res.status(400).json({
      error: "Invalid booking ID or M-PESA receipt"
    });
  }

  const bookings = await query(
    `SELECT id, status
     FROM bookings
     WHERE id = ?
     LIMIT 1`,
    [bookingId]
  );

  if (!bookings.length) {
    return res.status(404).json({
      error: "Booking not found"
    });
  }

  if (["confirmed", "cancelled"].includes(bookings[0].status)) {
    return res.status(409).json({
      error: "This booking cannot accept a new receipt"
    });
  }

  const existing = await query(
    `SELECT trans_id
     FROM mpesa_payments
     WHERE receipt_number = ?
     LIMIT 1`,
    [receipt]
  );

  if (existing.length) {
    return res.status(409).json({
      error: "This receipt has already been submitted"
    });
  }

  const transactionId =
    `MAN-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  await query(
    `INSERT INTO mpesa_payments
      (trans_id, amount, account, receipt_number,
       booking_id, status, payment_source, received_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 'manual', ?)`,
    [
      transactionId,
      0,
      "7845616",
      receipt,
      bookingId,
      Date.now()
    ]
  );

  await query(
    `UPDATE bookings
     SET status = 'payment_submitted'
     WHERE id = ?
       AND status = 'awaiting_payment'`,
    [bookingId]
  );

  return res.status(201).json({
    ok: true,
    booking_id: bookingId,
    receipt_number: receipt,
    status: "pending",
    message: "Receipt submitted for administrator verification"
  });
}));


 // ADMIN: View M-PESA receipts awaiting verification
app.get("/api/admin/mpesa", auth, asyncRoute(async (req, res) => {
  const receipts = await query(`
    SELECT
      m.trans_id,
      m.receipt_number,
      m.booking_id,
      m.amount,
      m.status,
      m.payment_source,
      m.received_at,
      m.reviewed_at,
      b.ref AS booking_reference,
      b.name AS guest_name,
      b.phone AS guest_phone,
      b.total AS booking_total
    FROM mpesa_payments m
    LEFT JOIN bookings b ON b.id = m.booking_id
    ORDER BY m.received_at DESC
  `);

  res.json(receipts);
}));


app.post("/api/admin/mpesa/verify", auth, asyncRoute(async (req, res) => {
  const receipt = String(req.body?.receipt_number || "")
    .trim()
    .toUpperCase();

  const amount = Number(req.body?.verified_amount);
  const evidence = String(req.body?.verification_reference || "").trim();

  if (
    !/^[A-Z0-9]{8,20}$/.test(receipt) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    evidence.length < 5
  ) {
    return res.status(400).json({
      error: "Valid receipt, verified amount and verification reference required"
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [receipts] = await conn.execute(
      `SELECT * FROM mpesa_payments
       WHERE receipt_number = ?
       FOR UPDATE`,
      [receipt]
    );

    if (receipts.length !== 1 || receipts[0].status !== "pending") {
      await conn.rollback();
      return res.status(409).json({
        error: "Receipt not found or already reviewed"
      });
    }

    const payment = receipts[0];

    const [bookings] = await conn.execute(
      `SELECT id, total, status
       FROM bookings
       WHERE id = ?
       FOR UPDATE`,
      [payment.booking_id]
    );

    if (
      bookings.length !== 1 ||
      !["awaiting_payment", "payment_submitted"].includes(bookings[0].status)
    ) {
      await conn.rollback();
      return res.status(409).json({
        error: "Booking cannot be confirmed"
      });
    }

    const booking = bookings[0];

    const [previousPayments] = await conn.execute(
      `SELECT COALESCE(SUM(amount), 0) AS paid
       FROM payments
       WHERE booking_id = ? AND status = 'completed'`,
      [booking.id]
    );

    const outstanding =
      Number(booking.total) - Number(previousPayments[0].paid);

    if (outstanding <= 0 || amount !== outstanding) {
      await conn.rollback();
      return res.status(400).json({
        error: "Verified amount must equal the outstanding booking balance",
        outstanding
      });
    }

    const [duplicates] = await conn.execute(
      `SELECT id FROM payments
       WHERE transaction_reference = ?
         AND payment_method = 'mpesa'
       LIMIT 1`,
      [receipt]
    );

    if (duplicates.length) {
      await conn.rollback();
      return res.status(409).json({
        error: "This receipt has already been recorded"
      });
    }

    await conn.execute(
      `UPDATE mpesa_payments
       SET amount = ?, status = 'verified', reviewed_at = NOW()
       WHERE trans_id = ?`,
      [amount, payment.trans_id]
    );

    await conn.execute(
      `INSERT INTO payments
       (booking_id, payment_method, amount,
        transaction_reference, receipt_number,
        status, paid_at)
       VALUES (?, 'mpesa', ?, ?, ?, 'completed', NOW())`,
      [booking.id, amount, receipt, receipt]
    );

    await conn.execute(
      `UPDATE bookings
       SET status = 'confirmed',
           receipt_number = ?,
           confirmed_at = ?
       WHERE id = ?`,
      [receipt, Date.now(), booking.id]
    );

    await conn.commit();

    res.json({
      ok: true,
      booking_id: booking.id,
      receipt_number: receipt,
      verified_amount: amount,
      verification_reference: evidence,
      status: "confirmed",
      message: "Payment recorded and booking confirmed"
    });

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

// ======================================================
// FINANCE
// ======================================================


app.get("/api/admin/finance", auth, asyncRoute(async (req, res) => {
  const [revenueRows, methods, bookings] = await Promise.all([
    query(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE status = 'completed'
    `),

    query(`
      SELECT
        payment_method AS method,
        COALESCE(SUM(amount), 0) AS amount
      FROM payments
      WHERE status = 'completed'
      GROUP BY payment_method
    `),

    query(`
      SELECT
        b.id,
        b.total AS total_amount,
        COALESCE(
          SUM(
            CASE
              WHEN p.status = 'completed'
              THEN p.amount
              ELSE 0
            END
          ), 0
        ) AS paid
      FROM bookings b
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.status != 'cancelled'
      GROUP BY b.id, b.total
    `)
  ]);

  // Keep your existing finance calculations
  // and res.json(...) response below this line.


  const outstanding = bookings.reduce(
    (sum, b) => sum + Math.max(
      0,
      // Number(b.total_amount) - Number(b.paid)
      Number(b.total) - Number(b.paid)
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
// SERVE EWALEL REACT FRONTEND
// ======================================================

// Serve compiled React assets
app.use(express.static(clientDist));

// Serve React pages and support browser refreshes
app.use((req, res, next) => {
  // Keep API requests separate from frontend routes
  if (req.path.startsWith("/api/")) {
    return next();
  }

  // Only serve the React app for page requests
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }

  // Missing static files should not return the React page
  if (path.extname(req.path)) {
    return next();
  }

  res.sendFile(path.join(clientDist, "index.html"), err => {
    if (err) next(err);
  });
});

// ======================================================
// ERROR HANDLING
// ======================================================
// ======================================================
// SERVE EWALEL REACT FRONTEND
// ======================================================

const frontendPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/dist"
);

// Serve React files
app.use(express.static(frontendPath));

// React frontend routes
app.use((req, res, next) => {
  if (
    req.method !== "GET" ||
    req.path.startsWith("/api/") ||
    req.path.startsWith("/uploads/") ||
    path.extname(req.path)
  ) {
    return next();
  }

  res.sendFile(
    path.join(frontendPath, "index.html"),
    err => {
      if (err) next(err);
    }
  );
});
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
