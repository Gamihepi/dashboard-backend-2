# Addon Backend (Node.js + MySQL + SFTP)

## Run

1. Copy `.env.example` to `.env` and fill DB/SFTP values.
2. Run SQL from `sql/setup.sql` in MySQL.
3. Install and start:

```bash
npm install
npm run dev
```

Backend URL: `http://localhost:4101`

## Render keep-alive

Render sleeping cannot be fixed by an in-process `setInterval`, because the timer stops once the web service sleeps. Use an external ping every 10 minutes against this endpoint:

- `GET /api/cron/keep-alive`
- Optional protection: set `CRON_SECRET` in Render and call `GET /api/cron/keep-alive?key=YOUR_SECRET`

Example Render Cron command:

```bash
curl -fsS "https://your-service.onrender.com/api/cron/keep-alive?key=$CRON_SECRET"
```

Recommended Render setup:

1. Add `CRON_SECRET` to the backend web service environment variables.
2. Create a Render Cron Job scheduled for every 10 minutes.
3. Use the `curl` command above, replacing `your-service` with the real backend URL.

## Main APIs

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/overview`
- `GET /api/mods`
- `GET /api/mods/:id`
- `POST /api/mods`
- `PUT /api/mods/:id`
- `POST /api/mods/:id/assets` (multipart: `displayImage`, `subImages[]`, `modFiles[]`)
- `GET /api/admin/users`, `POST/PUT/DELETE /api/admin/users/:id`
- `GET /api/admin/roles`, `POST/PUT/DELETE /api/admin/roles/:id`
- `GET/PUT /api/admin/roles/:id/permissions`
