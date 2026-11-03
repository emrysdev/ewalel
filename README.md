# Ewalel Cottages — independent designed full-stack application

This is a **new, separate project** based on the five-tab admin UI design, not a copy of the user's original application.

## Contents
- `client/`: React + Vite dashboard
- `server/`: Node.js + Express REST API, administrator JWT authentication, MySQL queries
- `mysql/schema.sql`: new isolated MySQL database (`ewalel_designed`)

## Setup (Windows / VS Code)
1. Install Node.js 20+ and MySQL 8+.
2. In MySQL Workbench, open and execute `mysql/schema.sql`. **This creates a new database; do not run it over your existing Ewalel database.**
3. Create a dedicated MySQL user with access to `ewalel_designed` (or use your own existing authorized account). For example, using a privileged MySQL session:
   ```sql
   CREATE USER IF NOT EXISTS 'ewalel_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
   GRANT SELECT,INSERT,UPDATE,DELETE ON ewalel_designed.* TO 'ewalel_app'@'localhost';
   ```
4. Copy `server/.env.example` to `server/.env`. Fill in MySQL credentials, a long random `JWT_SECRET`, and an `ADMIN_EMAIL` and strong `ADMIN_PASSWORD`. Never commit `.env`.
5. From the `server` folder run `npm install`, then `node create-admin.js`, then `npm run dev`.
6. Copy `client/.env.example` to `client/.env`. From the `client` folder run `npm install` and `npm run dev`.
7. Open `http://localhost:5173` and sign in with the admin credentials you configured.

## Included features
- Admin sign-in with bcrypt-hashed password and JWT.
- Cottage creation with name, location, price, capacity, description, optional photo URL.
- Maintenance scheduling, previous maintenance history, completion tracking and costs.
- Booking API with basic date conflict and maintenance-date checks; booking management UI.
- Payment acknowledgement entry (manual, with reference), live revenue, outstanding balances, method breakdown and 15-second refresh.
- REST API health check at `http://localhost:3001/api/health`.

## Limitations / production work
- **M-PESA STK Push and card gateway are NOT integrated.** Payment entry is manual and must be independently verified. Never enter real card numbers in this app.
- This is an **admin-first** full-stack MVP, not a complete guest-facing booking storefront. Public `GET /api/cottages` and `POST /api/bookings` APIs exist, but guest booking UI is not included.
- Reports are a placeholder; no XLSX export yet.
- Add rate limiting, HTTPS, access logging, backup/restore, CSRF/session strategy as applicable, secure media uploads and gateway webhook verification before production deployment.
- Booking conflict protection uses a per-cottage database row lock; external channel bookings and time-zone nuances require further integration.
- Photo management currently uses URL fields, not binary upload.
- No demo revenue is seeded; revenue is 0 until completed payments are entered.

## Key API endpoints
`POST /api/auth/login`, `GET /api/cottages`, `POST /api/bookings`, `GET/POST /api/admin/cottages`, `PATCH /api/admin/cottages/:id`, `GET/POST /api/admin/maintenance`, `PATCH /api/admin/maintenance/:id`, `GET/PATCH /api/admin/bookings`, `GET/POST /api/admin/payments`, `GET /api/admin/finance`.

All `/api/admin/*` routes require `Authorization: Bearer <token>`.


## Guest website UI (new)

The default URL `/` is the guest website with the supplied Ewalel A-frame exterior and interior photographs, the teal/cream theme, cottage listings, and booking request form. `/admin` is the existing five-tab dashboard with maintenance history.

Guest cottage listings come from MySQL through `GET /api/cottages`; guest booking requests use `POST /api/bookings` and remain **pending**. The form does **not** charge a card or initiate M-PESA. The selected payment method is an indication only and is not persisted or processed. Staff must verify and record actual payments in Admin.

Set `VITE_API_URL` to your server origin (for example `http://localhost:3001`). Start the MySQL database and backend before using live bookings. Photos are bundled in `client/public/images`.


## Rebuilt screenshot-matched guest UI (November 2026)

The root `/` guest site uses the **same page structure as the supplied screenshot**: deep teal two-row header, full-width actual Ewalel A-frame exterior photograph without text overlay, cream welcome panel, full-width dark booking button, date/guest search controls, and actual interior gallery. Cottage listings are fetched from MySQL, and reservation conflicts are checked transactionally by the Express API. Admin is at `/admin`.

**Important:** No live M-PESA or card gateway is installed. The guest payment-method selection is informational; a reservation is created as pending and only verified payments entered by authorized staff count toward revenue. Do not put real payment card details in this application.

**Photo attribution:** Five photographs supplied by the user are included in `client/public/images`. Interior photographs are a shared gallery until the property owner associates them with particular cottages.
