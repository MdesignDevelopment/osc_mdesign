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

## Default Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@osc.be | admin123 |
| Support Engineer | support@osc.be | support123 |
| External | extern@osc.be | extern123 |

> **Change passwords** after first login via User Management.

## Features

- **Dashboard** — Stats cards, status distribution pie chart, partner bar chart, recent requests
- **OSC Requests** — Paginated table with search, status/partner/priority filters
- **OSC Detail / Story Line** — Jira-style activity timeline with comments and change history
- **OSC Form** — Create/edit with all fields: partner, popzone, dates, status, priority, remark
- **User Management** — Admin-only: create, edit, activate/deactivate users, assign roles

## Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — users, all OSC operations, delete comments |
| **Support Engineer** | Create/edit OSC requests, comment |
| **External** | Read-only — view dashboard, OSC list, and detail pages |

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
