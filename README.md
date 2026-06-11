# OSC Tracker

OSC Update Status Tracking System built with Next.js 14, PostgreSQL, and Docker.

## Quick Start with Docker

```bash
# 1. Start the app + database
docker compose up -d

# 2. In a separate terminal, run migrations + seed (first time only)
# Copy your Excel file first:
#   cp "path/to/OSCs-update-status.xlsx" data/
docker compose --profile migrate up migrate

# 3. Open http://localhost:3000
```

## Features

- **Dashboard** — Stats cards, status distribution pie chart, partner bar chart, recent requests
- **OSC Requests** — Paginated table with search, status/partner/priority filters
- **OSC Detail / Story Line** — Jira-style activity timeline with comments and change history
- **OSC Form** — Create/edit with all fields: partner, popzone, dates, status, priority, remark
- **User Management** — Admin-only: create, edit, activate/deactivate users, assign roles
- **API Integration** — Data API with a daily-rotating key for loading OSC requests into Excel (Power Query), Power BI, or any HTTP client

## Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — users, all OSC operations, delete comments |
| **Support Engineer** | Create/edit OSC requests, comment |
| **External** | Read-only — view dashboard, OSC list, and detail pages |

## API Integration (Excel / Power Query)

The app exposes a read-only data API for external tools:

```
GET /api/v1/osc-requests
```

- Returns **all OSC requests** as JSON (`{ generatedAt, count, data: [...] }`).
- Authenticated with a **daily-rotating API key** — pass it as an `X-API-Key` header or `?api_key=` query parameter.
- The key is derived from `API_KEY_SECRET` (or `NEXTAUTH_SECRET`) + the current UTC date, so it changes automatically at **midnight UTC** with no cron job or database state.
- Any logged-in user (including External users) can copy the current key from the **API Integration** page in the app, which also contains a step-by-step Excel Power Query guide with a ready-to-paste M script.

When an Excel refresh fails with `401 Unauthorized`, the key has rotated — copy the new key from the API Integration page and update the `ApiKey` value in the Power Query script.

## Development (without Docker)

Requires Node.js 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL

npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret (min 32 chars) |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `XLSX_PATH` | Path to Excel file for seeding (seed script only) |
| `API_KEY_SECRET` | Optional — secret used to derive the daily data API key (falls back to `NEXTAUTH_SECRET`) |
