# Ewalel Cottages — React + Express + MySQL

## 1. Create database in MySQL Workbench

Start **MySQL Server**, open MySQL Workbench, connect to your local server, open `backend/schema.sql`, and click the lightning-bolt Execute button. This creates `ewalel_cottages` with `properties` and `bookings` tables and inserts the two cottages.

Workbench is a management client; **MySQL Server must be running** for the website to save reservations.

## 2. Configure backend

From `backend/`, copy `.env.example` to `.env` and enter your MySQL credentials. Do not commit `.env`.

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

Verify http://localhost:3001/api/health returns `{ "status": "ok", "database": "mysql" }`.

## 3. Run frontend (second terminal)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite proxy forwards `/api` to the backend on port 3001.

## 4. View bookings in Workbench

```sql
USE ewalel_cottages;
SELECT b.id, p.name AS property, b.guest_name, b.phone, b.check_in, b.check_out,
       b.total_kes, b.status, b.created_at
FROM bookings b JOIN properties p ON p.id = b.property_id
ORDER BY b.created_at DESC;
```

## API

- `GET /api/health`: checks MySQL connection
- `GET /api/bookings`: booked date ranges per property
- `POST /api/bookings`: stores a pending booking and blocks date conflicts

## Important

- The website **does not process payments** or send booking notifications.
- Pending reservations block dates until their status is changed to `cancelled`.
- Booking contact details are personal data; do not publish your database or credentials.
- For Railway deployment, provision a hosted MySQL database, set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in Railway environment variables, and run `schema.sql` against that database. Your local Workbench can connect to the hosted database if permitted.
- Admin login, rate limiting, email notifications, and secure database access should be added before public production use.
