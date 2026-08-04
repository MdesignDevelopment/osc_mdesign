# SPEC — Wyer/Merkator Support Engineer role + Design Session & Addresses Trackers

Status: Draft for review
Author: Product Owner / Systems Architect
Date: 2026-08-03
Target platform: `osc-tracker` (Next.js 14 App Router · Prisma 5 · PostgreSQL · NextAuth v4 JWT)

---

## 0. Scope

Three deliverables:

1. **New role** — `Wyer/Merkator Support Engineer`, with read/write access scoped to the two new modules and nothing else.
2. **Module 1 — Design Session Tracker** — POP zone design sessions, with a read-only OSC Status projected from the existing OSC Tracker data, plus a per-POP-zone script execution list.
3. **Module 2 — Addresses Tracker** — address-related operational requests.

Both modules require full field-level audit trails and a detail view that shows every editable field, module-specific extra data, and the complete log.

---

## 1. Findings from the existing codebase that constrain this design

These are not observations for their own sake — each one changes what has to be built.

### 1.1 (P0, blocking) Role checks are written as denylists, so a new role silently inherits OSC write access

Every write path in the OSC module gates on *"is the user EXTERN?"* rather than *"is the user allowed?"*:

- [route.ts:27](src/app/api/osc/[id]/route.ts#L27) and [route.ts:98](src/app/api/osc/[id]/route.ts#L98) — `PUT` / `DELETE`
- [route.ts:55](src/app/api/osc/route.ts#L55) — create
- [route.ts:104](src/app/api/osc/bulk/route.ts#L104), [route.ts:42](src/app/api/osc/bulk/row/route.ts#L42), [route.ts:10](src/app/api/osc/bulk-status/route.ts#L10) — bulk import / bulk status

The moment `WM_SUPPORT_ENGINEER` is added to the `Role` enum, a user holding it passes every one of those checks. It would be able to edit, bulk-overwrite and **delete** OSC requests — the exact opposite of the "dedicated access to two specific dashboards" requirement. The same pattern exists in the UI layer at [page.tsx:11](src/app/osc/new/page.tsx#L11) and [page.tsx:11](src/app/osc/[id]/edit/page.tsx#L11).

**Consequence:** converting these checks to an allowlist capability model (§4) is a *prerequisite* for shipping the role, not a follow-up refactor. It is the first task in the delivery plan.

### 1.2 `popzone` is not *guaranteed* unique, so "fetch the OSC Status for this record" needs a documented rule

**Corrected 2026-08-03, after measuring the live database.** Both numbers below are verified:

| Source | Rows | Distinct POP zones | Ratio |
|---|---|---|---|
| `osc_dump.sql` (May snapshot, committed to the repo) | 1,636 | 387 | ~4.2× |
| **Live Neon database (current)** | **433** | **433** | **1.00× — no duplicates** |

An earlier draft of this spec quoted only the dump figure and described the current data as ~4.2 requests per zone. That was wrong: the duplication was cleaned up between that snapshot and now — consistent with the `OscRequest_Backup` table (536 rows, 426 distinct) and commit `4e9f4df`. Today the relationship is effectively 1:1.

It is not, however, *enforced* as 1:1:

- `OscRequest` has no unique constraint on `popzone`.
- `POST /api/osc` creates a request with no duplicate check at all, so two requests for one zone can be created through the UI.
- Only the bulk importer de-duplicates (it upserts on lowercased `popzone`), which is why the live data is currently clean.
- The model deliberately supports repeat requests over time (`receivedDate`, `oscRequestDate`, `mailSentDate`, `updatedDate`).

**Consequence:** the disambiguation rule in §6.4 stays, as a correctness safety net rather than a fix for a present-day crisis. Its practical effect on today's data is nil — every zone resolves to exactly one request, so the "most recent of N" caption never renders. The priority attached to this finding was overstated; the design is unchanged and costs nothing.

### 1.3 The schema has zero indexes

`grep '@@index' prisma/schema.prisma` returns nothing. Every lookup today is a sequential scan. That is survivable at 1.6k rows, but the OSC Status projection adds a `popzone`-keyed lookup on every Design Session list render, and the audit table is append-only and will grow fastest of any table in the system.

**Consequence:** indexes are specified explicitly in §3, including one added to the existing `OscRequest` model.

### 1.4 The audit trail is currently hard-wired to one entity

`OscHistory` ([schema.prisma](prisma/schema.prisma)) carries a real FK to `OscRequest`. The write pattern — build a `changes[]` array by diffing old vs. new, then persist it in the *same* `prisma.$transaction` as the update — is sound and worth preserving verbatim ([route.ts:44-95](src/app/api/osc/[id]/route.ts#L44-L95)).

But the entity-specific FK does not generalise. It also has a known weakness: `onDelete: SetNull` means history for a deleted request loses its subject, and the UI has to render the string `"Deleted request"` ([page.tsx](src/app/history/page.tsx)). Mirroring the pattern into `DesignSessionHistory` + `AddressRequestHistory` would triplicate that weakness and force the unified Change History page into a three-way query-and-merge.

**Consequence:** one generic `AuditLog` table for the new modules, with a snapshotted `entityLabel` so records stay readable after deletion (§5). `OscHistory` is left untouched — no risky backfill.

### 1.5 Adding a role breaks three lookup tables silently, not loudly

`ROLE_LABELS` and `ROLE_LOZENGE` in [utils.ts:62-75](src/lib/utils.ts#L62-L75) are declared as bare object literals, **not** `Record<Role, string>`. TypeScript will not flag the missing key; the sidebar ([sidebar.tsx](src/components/layout/sidebar.tsx)) and history page will render `undefined`. Additionally the role is hardcoded in [validations.ts](src/lib/validations.ts) (`userCreateSchema`, `userUpdateSchema`) and in the `<select>` at [user-form-dialog.tsx:122-124](src/components/users/user-form-dialog.tsx#L122-L124) — until all three are updated, an admin cannot assign the new role at all.

**Consequence:** §4.4 gives the exact checklist, and requires the lookup maps be re-typed as `Record<Role, …>` so the compiler catches the next role.

### 1.6 `prisma/migrations/` is empty — the project is on `db push`

`package.json` defines both `db:push` and `db:migrate deploy`, but no migration has ever been committed. Two of the changes here cannot be expressed in `schema.prisma` alone (a CHECK constraint and a normalised expression index), and `ALTER TYPE … ADD VALUE` on a Postgres enum has transactional restrictions.

**Consequence:** this change set is the right moment to adopt versioned migrations. See §3.5.

### 1.7 No script execution data exists anywhere in the platform

The requirement *"display all scripts that have been executed against this specific POP Zone"* has no source system inside this repo — no model, no table, no ingest route, nothing in the dump. This is net-new data, not a new view over existing data.

**Consequence:** the module needs an ingestion channel, not just a display surface. The platform already has the right vehicle: the daily-rotating API key in [api-key.ts](src/lib/api-key.ts) and the external API namespace at `src/app/api/v1/`. Specified in §6.5. **This is the single largest scope item in the spec and the most likely candidate to defer to Phase 4.**

---

## 2. Assumptions and open decisions

Where the brief admitted more than one reading, I made a call and flagged it. Items marked **⚠ Confirm** change the data model if answered differently — they are cheap to settle now and expensive to reverse after data lands.

| # | Question | Decision taken | Impact if wrong |
|---|---|---|---|
| A1 | "POP Zone (Text) – Unique identifier" — one Design Session per POP zone, ever? | **Yes** — `@@unique([popZoneKey])`. Consistent with commit `4e9f4df` ("upload design sessions one time eleminating duplicates"). | ⚠ **Confirm.** If a POP zone can be re-designed in a later round, this must become `@@unique([popZoneKey, sessionRound])` plus a `sessionRound Int @default(1)`. Cheap now, migration + de-dup later. |
| A2 | "Tina_UUID / AAP_ID (Text)" — one field or two? | **Two** nullable columns (`tinaUuid`, `aapId`), with a constraint that at least one is present. They are different identifier namespaces; merging them into one column destroys search, indexing, and any future join to `aapOnHold` in Module 1. | ⚠ **Confirm.** If the source is genuinely one free-text column, collapse to `externalRef` and drop the CHECK constraint. |
| A3 | "Reporter (Text)" — free text or a platform user? | **Free text**, with an *optional* `reportedById` FK for when the reporter is a known user. Reporters are frequently external; the audit trail separately records the acting user. | Low. Additive either way. |
| A4 | Should the new role see the OSC Tracker module? | **Yes — full read/write/delete. Decided by the product owner 2026-08-03**, reversing the original "no" in two steps (first read-only, then full CRUD). See §4.2.1. | Resolved. |
| A5 | Does the new role get the unified Change History page? | **Yes, filtered** to the two modules it owns. It must never see OSC request history. | Medium — drives the tabbed history design in §5.4. |
| A6 | Can the new role delete records? | **Yes — superseded by the product owner 2026-08-03.** The role holds `osc:delete`, `design:delete` and `address:delete`. Deletion is soft-guarded by a mandatory typed reason and a permanent audit row, not by role. | Resolved. |
| A7 | Do `ADMIN` and the existing `SUPPORT_ENGINEER` also get the new modules? | **Yes** — `ADMIN` full, `SUPPORT_ENGINEER` read/write. The modules are operational, not Wyer/Merkator-exclusive. | Low. |
| A8 | Timezone convention for date-only fields | UTC midnight in storage, `Europe/Brussels` + `dd/MM/yyyy` on display, matching the existing `formatDate` helper and the `toISOString().split('T')[0]` audit convention. | Low, but must be applied consistently or audit diffs will show phantom ±1-day changes. |

---

## 3. Data model

### 3.1 Enum changes

```prisma
enum Role {
  ADMIN
  SUPPORT_ENGINEER
  EXTERN
  WM_SUPPORT_ENGINEER          // Wyer/Merkator Support Engineer
}

enum AddressRequestStatus {
  NOT_STARTED
  ON_HOLD
  BLOCKED
  COMPLETED
}

enum AuditEntity {
  DESIGN_SESSION
  ADDRESS_REQUEST
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
}

enum ScriptStatus {
  SUCCESS
  FAILED
  PARTIAL
  RUNNING
}
```

`AddressRequestStatus` is deliberately a **separate** enum from `OscStatus` even though both contain an "on hold" concept. They are different lifecycles on different entities; sharing the enum would couple two unrelated state machines and pollute `STATUS_LABELS`.

### 3.2 Module 1 — `DesignSession`

```prisma
model DesignSession {
  id          String  @id @default(cuid())

  popZone     String                        // as entered, e.g. "MRO_HAALTERT_01_POP_011"
  popZoneKey  String                        // normalised: upper(trim(popZone)) — the join/dedup key
  cabinetName String?                       // e.g. "H70CA03HA06"
  mroPartner  String?                       // e.g. "ZTE" — see note below
  notes       String? @db.Text
  actionsDone String? @db.Text

  sendOcRequestToPartner Boolean @default(false)
  aapOnHold              Boolean @default(false)
  readyToPost            Boolean @default(false)
  posted                 Boolean @default(false)

  createdById String
  createdBy   User     @relation("DesignSessionCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  scripts ScriptExecution[]

  @@unique([popZoneKey])                    // see assumption A1
  @@index([posted, readyToPost])
  @@index([mroPartner])
  @@index([updatedAt])
}
```

Notes:

- **`popZoneKey` is generated, never user-editable.** It is written by the application on every create/update as `popZone.trim().toUpperCase()`. It exists because the OSC Status lookup (§6.4) joins on POP zone across two tables populated by different import paths, and casing/whitespace drift between them is otherwise guaranteed. Do not expose it in the UI or the API response.
- **`mroPartner` is a plain string, not an FK to `Partner`.** The brief specifies Text, and the values ("ZTE") come from a different upstream feed than `Partner.name`. Forcing an FK now would make bulk import fail on any unknown partner. If reporting later needs to group Design Sessions and OSC Requests by the same partner dimension, add a nullable `partnerId` alongside it and reconcile in the background — do not swap the type.
- `posted`/`readyToPost` are indexed together because the default list view filters on exactly that pair (§6.2).

### 3.3 Module 1 — `ScriptExecution`

```prisma
model ScriptExecution {
  id String @id @default(cuid())

  popZoneKey      String                    // normalised; the durable link
  designSessionId String?
  designSession   DesignSession? @relation(fields: [designSessionId], references: [id], onDelete: SetNull)

  scriptName    String
  scriptVersion String?
  status        ScriptStatus
  executedAt    DateTime
  durationMs    Int?
  output        String? @db.Text            // truncate at ingest, see §6.5
  externalRef   String? @unique             // idempotency key from the runner

  executedByLabel String?                   // external actor, e.g. "ci-runner-03"
  executedById    String?                   // platform user, when triggered in-app
  executedBy      User?   @relation("ScriptExecutedBy", fields: [executedById], references: [id])

  createdAt DateTime @default(now())

  @@index([popZoneKey, executedAt])
  @@index([designSessionId])
}
```

The critical detail: scripts are keyed on **`popZoneKey`**, with `designSessionId` as a *derived convenience*. Script executions will arrive for POP zones that have no Design Session row yet, and the requirement is "all scripts executed against this POP Zone" — a zone-scoped question, not a session-scoped one. Keying on the session FK alone would silently drop early arrivals.

Resolution rules:
- On ingest: set `popZoneKey`, then resolve `designSessionId` if a session exists.
- On Design Session create: back-fill `designSessionId` on all `ScriptExecution` rows matching `popZoneKey`.
- On read: query by `popZoneKey`, never by `designSessionId`. The FK exists for cascade-free cleanup and joins, not as the read path.

`externalRef @unique` makes ingestion idempotent — a runner that retries a POST will not create duplicates. Given that `OscRequest` bulk import already needed a de-duplication fix (commit `4e9f4df`), designing idempotency in from the start is the cheaper path.

### 3.4 Module 2 — `AddressRequest`

```prisma
model AddressRequest {
  id String @id @default(cuid())

  requestDate    DateTime
  reporter       String
  reportedById   String?
  reportedBy     User?   @relation("AddressReportedBy", fields: [reportedById], references: [id])

  tinaUuid       String?                    // see assumption A2
  aapId          String?
  status         AddressRequestStatus @default(NOT_STARTED)
  notes          String? @db.Text
  completionDate DateTime?

  createdById String
  createdBy   User     @relation("AddressCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status, requestDate])
  @@index([tinaUuid])
  @@index([aapId])
  @@index([requestDate])
}
```

### 3.5 Audit — `AuditLog`

```prisma
model AuditLog {
  id String @id @default(cuid())

  entity      AuditEntity
  entityId    String
  entityLabel String                        // snapshot at write time — survives deletion

  userId String
  user   User   @relation("AuditActor", fields: [userId], references: [id])

  action       AuditAction
  fieldChanged String?                      // null for CREATE / DELETE summary rows
  oldValue     String? @db.Text
  newValue     String? @db.Text
  changedAt    DateTime @default(now())

  @@index([entity, entityId, changedAt])    // detail-view timeline
  @@index([userId, changedAt])              // "what did this user do"
  @@index([entity, changedAt])              // module-filtered history page
  @@index([changedAt])                      // global feed + retention sweeps
}
```

`entityId` is intentionally **not** a foreign key. That is the price of one generic table, and it buys: one place to register module 3/4/5, a single query for the unified history page, and audit rows that survive record deletion intact. `entityLabel` (the POP zone, or the Tina UUID / AAP ID) is snapshotted at write time so the history page never has to render `"Deleted request"`.

The trade-off — no referential integrity, orphan rows possible — is acceptable for an append-only audit log, where retaining a row whose subject is gone is the *desired* behaviour. It does mean deletion must not cascade, and a `DELETE` action row must be written before the record is removed (as the existing OSC delete path already does correctly at [route.ts:110-135](src/app/api/osc/[id]/route.ts#L110-L135)).

### 3.6 Changes to existing models

```prisma
model OscRequest {
  // … unchanged fields …
  @@index([popzone])        // NEW — required by the OSC Status projection (§6.4)
  @@index([status])         // NEW — existing list/dashboard filters, currently seq-scan
}

model User {
  // … unchanged fields …
  designSessions   DesignSession[]   @relation("DesignSessionCreatedBy")
  addressRequests  AddressRequest[]  @relation("AddressCreatedBy")
  addressesReported AddressRequest[] @relation("AddressReportedBy")
  scriptExecutions ScriptExecution[] @relation("ScriptExecutedBy")
  auditLogs        AuditLog[]        @relation("AuditActor")
}
```

### 3.7 Migration plan

Adopt versioned migrations with this change set. Three items need hand-written SQL beyond what `schema.prisma` expresses:

```sql
-- 1. Case/whitespace-insensitive matching between DesignSession.popZoneKey
--    and OscRequest.popzone, which are populated by different import paths.
CREATE INDEX idx_osc_request_popzone_norm
  ON "OscRequest" (upper(btrim("popzone")));

-- 2. Enforce assumption A2 at the database level, not just in zod.
ALTER TABLE "AddressRequest"
  ADD CONSTRAINT chk_address_identifier
  CHECK ("tinaUuid" IS NOT NULL OR "aapId" IS NOT NULL);

-- 3. Enforce the completion invariant from §7.4.
ALTER TABLE "AddressRequest"
  ADD CONSTRAINT chk_address_completion
  CHECK (status <> 'COMPLETED' OR "completionDate" IS NOT NULL);
```

Sequencing caution:

- `ALTER TYPE "Role" ADD VALUE 'WM_SUPPORT_ENGINEER'` must land in its **own migration**, applied and committed before any migration or seed that *references* the new value. Postgres cannot use a newly added enum value in the same transaction that created it.
- Run `prisma migrate dev --create-only` first, then hand-edit to insert the raw SQL above, then apply. Do not use `db:push` for this change set — the CHECK constraints and the expression index would be dropped on the next push.
- Backfill for `popZoneKey` is not needed (new table), but the `DesignSession` bulk importer must populate it from row one.

---

## 4. Role and permission model

### 4.1 The capability layer (new file: `src/lib/permissions.ts`)

Replaces scattered role comparisons with a single declarative matrix. This is the fix for finding §1.1.

```ts
import { Role } from '@prisma/client'

export type Capability =
  | 'osc:read'     | 'osc:write'     | 'osc:delete'
  | 'design:read'  | 'design:write'  | 'design:delete'
  | 'address:read' | 'address:write' | 'address:delete'
  | 'audit:read:osc' | 'audit:read:design' | 'audit:read:address'
  | 'scripts:ingest'
  | 'users:manage'

const MATRIX: Record<Role, readonly Capability[]> = {
  ADMIN: [ /* all capabilities */ ],

  SUPPORT_ENGINEER: [
    'osc:read', 'osc:write', 'osc:delete',
    'design:read', 'design:write',
    'address:read', 'address:write',
    'audit:read:osc', 'audit:read:design', 'audit:read:address',
  ],

  WM_SUPPORT_ENGINEER: [
    'design:read', 'design:write',
    'address:read', 'address:write',
    'audit:read:design', 'audit:read:address',
    'osc:read', 'audit:read:osc',   // read-only OSC visibility (A4, reversed)
    // withheld: osc:write, osc:delete, osc:comment, api:integration
  ],

  EXTERN: ['osc:read'],
}

export function can(role: Role, cap: Capability): boolean {
  return MATRIX[role]?.includes(cap) ?? false
}
```

Paired server-side guards in [auth.ts](src/lib/auth.ts), alongside the existing `requireAuth` / `requireRole`:

```ts
export const requireCapability = async (cap: Capability) => {
  const session = await requireAuth()
  if (!can(session.user.role as Role, cap)) throw new Error('Forbidden')
  return session
}
```

`MATRIX` being typed `Record<Role, …>` means the next role added to the enum is a **compile error** until its capabilities are declared. That is the point: it converts §1.1's silent privilege grant into a build failure.

### 4.2 Capability matrix

| Capability | Gates | ADMIN | SUPPORT_ENGINEER | WM_SUPPORT_ENGINEER | EXTERN |
|---|---|---|---|---|---|
| `osc:read` | `/osc` list + detail, `/dashboard`, XLSX export | ✅ | ✅ | ✅ | ✅ |
| `osc:write` | create / edit / bulk import OSC requests | ✅ | ✅ | ✅ | ❌ |
| `osc:delete` | delete an OSC request | ✅ | ✅ | ✅ | ❌ |
| `osc:comment` | post a comment on an OSC request | ✅ | ✅ | ✅ | ✅ |
| `design:read` | `/design-sessions` | ✅ | ✅ | ✅ | ❌ |
| `design:write` | create / edit / toggle / bulk import | ✅ | ✅ | ✅ | ❌ |
| `design:delete` | delete a design session | ✅ | ❌ | ✅ | ❌ |
| `address:read` | `/addresses` | ✅ | ✅ | ✅ | ❌ |
| `address:write` | create / edit / inline status | ✅ | ✅ | ✅ | ❌ |
| `address:delete` | delete an address request | ✅ | ❌ | ✅ | ❌ |
| `audit:read:osc` | OSC tab of `/history` | ✅ | ✅ | ✅ | ❌ |
| `audit:read:design` | Design Sessions tab of `/history` | ✅ | ✅ | ✅ | ❌ |
| `audit:read:address` | Addresses tab of `/history` | ✅ | ✅ | ✅ | ❌ |
| `api:integration` | `/api-integration` — **displays the live data-API key** | ✅ | ✅ | ❌ | ❌ |
| `scripts:ingest` | `/api/v1/script-executions` (API-key auth) | ✅ | ❌ | ❌ | ❌ |
| `users:manage` | `/users` | ✅ | ❌ | ❌ | ❌ |

#### 4.2.1 Scope history, and why `osc:read` was split anyway

The role's OSC access was widened twice on 2026-08-03: **none → read-only → full read/write/delete**. It now differs from `ADMIN` only in `users:manage`, `api:integration` and `scripts:ingest`, and from `SUPPORT_ENGINEER` only by *gaining* the three `*:delete` capabilities and losing `api:integration`. Worth stating plainly, since the role began life as "dedicated access to two specific dashboards".

The split below was done during the read-only step and is kept: `osc:read` was gating four separable things, two of which are not "seeing OSC requests" and should never travel with a read grant to any future role.

| Thing it gated | Intended by the request? | Resolution |
|---|---|---|
| OSC list, detail, export | Yes | stays on `osc:read` |
| OSC dashboard | Yes — it is a view of OSC requests | stays on `osc:read` |
| Posting comments on OSC requests | A write to OSC data | split out as `osc:comment` (since granted) |
| `/api-integration`, which renders the live API key | No — that is a **credential** | split out as `api:integration` (still withheld) |

Two pre-existing defects surfaced while doing this, both now fixed:

- **`/api-integration` had no capability guard at all** — only a session check ([layout.tsx](src/app/api-integration/layout.tsx)). The nav entry was conditionally hidden, but the URL was reachable by *any* signed-in user, including `EXTERN`. The live daily-rotating data-API key was one typed URL away for every account.
- **`canComment` was hardcoded `true`** on the OSC detail page ([page.tsx](src/app/osc/[id]/page.tsx)), so the compose box rendered for roles the API would reject. It now tracks `osc:comment`.

`EXTERN` keeps `osc:comment`, preserving today's reviewer behaviour. `api:integration` remains withheld from the Wyer/Merkator role: it was never requested, and an API key is not an operational record.

#### 4.2.2 Landing routes are explicit, not derived

`landingRoute()` previously returned `/dashboard` for anyone with `osc:read`. Now that the Wyer/Merkator role holds `osc:read`, that would have relocated its home to the OSC dashboard — away from the two modules the role exists for. Landing routes are now a declared `HOME` map per role, with a capability check so a redirect can never bounce someone to another page they are also barred from:

| Role | Home |
|---|---|
| `ADMIN`, `SUPPORT_ENGINEER` | `/dashboard` |
| `WM_SUPPORT_ENGINEER` | `/design-sessions` |
| `EXTERN` | `/osc` (it has no dashboard-worthy overview) |

### 4.3 Required migration of existing call sites

Mechanical, but **must be complete before the enum value ships** (§1.1). Each `role === 'EXTERN'` becomes a positive capability check:

| File | Change |
|---|---|
[route.ts:27](src/app/api/osc/[id]/route.ts#L27) | `→ requireCapability('osc:write')` |
[route.ts:98](src/app/api/osc/[id]/route.ts#L98) | `→ requireCapability('osc:delete')` |
[route.ts:55](src/app/api/osc/route.ts#L55) | `→ requireCapability('osc:write')` |
[route.ts:104](src/app/api/osc/bulk/route.ts#L104) | `→ requireCapability('osc:write')` |
[route.ts:42](src/app/api/osc/bulk/row/route.ts#L42) | `→ requireCapability('osc:write')` |
[route.ts:10](src/app/api/osc/bulk-status/route.ts#L10) | `→ requireCapability('osc:write')` |
[page.tsx:11](src/app/osc/new/page.tsx#L11) | `→ if (!can(role,'osc:write')) redirect('/dashboard')` |
[page.tsx:11](src/app/osc/[id]/edit/page.tsx#L11) | `→ if (!can(role,'osc:write')) redirect('/dashboard')` |
[page.tsx:86](src/app/osc/page.tsx#L86) | `canCreate = can(role,'osc:write')` |
[page.tsx:36](src/app/osc/[id]/page.tsx#L36) | `canEdit = can(role,'osc:write')` |
[layout.tsx:8](src/app/history/layout.tsx#L8) | `→ any audit:read:* capability` |
[route.ts:39](src/app/api/osc/[id]/comments/[commentId]/route.ts#L39) | Leave as-is — ownership check, not a role check |

Note the redirect targets: never hardcode `/osc` or `/dashboard`. Use `landingRoute(role)` (§4.2.2), which resolves each role's declared home and verifies the viewer can actually reach it.

### 4.4 Role-registration checklist (finding §1.5)

- [ ] `prisma/schema.prisma` — add `WM_SUPPORT_ENGINEER` to `Role` (own migration)
- [ ] [utils.ts:62](src/lib/utils.ts#L62) — `ROLE_LABELS`, **re-typed** `Record<Role, string>`, add `WM_SUPPORT_ENGINEER: 'Wyer/Merkator Support Engineer'`
- [ ] [utils.ts:68](src/lib/utils.ts#L68) — `ROLE_LOZENGE`, **re-typed** `Record<Role, string>`, add `'bg-teal-600 text-white'` (unused by existing roles: violet/blue/zinc)
- [ ] `src/lib/permissions.ts` — declare capabilities (compile-enforced)
- [ ] [validations.ts](src/lib/validations.ts) — add to the `role` enum in `userCreateSchema` **and** `userUpdateSchema`; consider `z.nativeEnum(Role)` to stop hand-maintaining these lists
- [ ] [user-form-dialog.tsx:122](src/components/users/user-form-dialog.tsx#L122) — add `<option>`; consider mapping over `ROLE_LABELS`
- [ ] [sidebar.tsx](src/components/layout/sidebar.tsx) — replace `adminOnly` / `noExtern` flags with a `capability` field per nav item
- [ ] `prisma/seed.ts` — seed one user with the new role for QA
- [ ] `ROLE_LABELS` truncation check — "Wyer/Merkator Support Engineer" is 30 chars and renders in a `truncate` container at 220px sidebar width. Use a short label (`'Wyer/Merkator'`) in the sidebar footer, full label in user management and audit rows.

### 4.5 Navigation and landing route

`sidebar.tsx` moves from ad-hoc booleans to capabilities:

```ts
const navItems = [
  { href: '/dashboard',       label: 'Dashboard',        icon: LayoutDashboard, capability: null },
  { href: '/osc',             label: 'OSC Requests',     icon: ClipboardList,   capability: 'osc:read' },
  { href: '/design-sessions', label: 'Design Sessions',  icon: LayoutGrid,      capability: 'design:read' },
  { href: '/addresses',       label: 'Addresses',        icon: MapPin,          capability: 'address:read' },
  { href: '/history',         label: 'Change History',   icon: History,         capability: 'audit:any' },
  { href: '/users',           label: 'User Management',  icon: Users,           capability: 'users:manage' },
  { href: '/api-integration', label: 'API Integration',  icon: Plug,            capability: 'osc:read' },
  { href: '/settings',        label: 'Settings',         icon: Settings,        capability: null },
]
```

Two consequences worth calling out:

1. **`/dashboard` is OSC-centric.** It renders OSC request charts and stats. Sending `WM_SUPPORT_ENGINEER` there as a landing page leaks OSC aggregate data and shows a dashboard with nothing actionable on it. Either scope the dashboard by capability, or land the role directly on `/design-sessions`. **Recommendation: land on `/design-sessions`** and gate `/dashboard`'s OSC panels behind `osc:read` — smaller change, no data leak.
2. **`/api-integration`** exposes the daily API key ([api-key.ts](src/lib/api-key.ts)). Keep it gated to `osc:read` at minimum; if script ingestion (§6.5) uses a separate key, that key needs its own page section gated on `scripts:ingest`.

### 4.6 Middleware

[middleware.ts](src/middleware.ts) matches only `/dashboard`, `/osc`, `/users`, `/settings`, `/api-integration`. The new routes must be added or they are reachable unauthenticated:

```ts
export const config = {
  matcher: [
    '/dashboard/:path*', '/osc/:path*', '/users/:path*',
    '/settings/:path*', '/api-integration/:path*',
    '/design-sessions/:path*',   // NEW
    '/addresses/:path*',         // NEW
    '/history/:path*',           // NEW — currently unmatched; pre-existing gap
  ],
}
```

`/history` is missing from the current matcher. Its layout does `getSession()` + redirect so it is not actually exposed, but it relies on the page guard alone rather than defence in depth. Worth fixing in the same pass.

Middleware provides authentication only. Capability enforcement stays in layouts (redirect) and API routes (403) — never in the client.

---

## 5. Audit trail

### 5.1 Design principles

1. **Field-level, not snapshot.** One row per changed field, matching the existing `OscHistory` semantics and the "old → new" UI at [page.tsx](src/app/history/page.tsx).
2. **Atomic with the mutation.** The audit write goes in the *same* `prisma.$transaction` as the update. A committed change with no log entry is a broken audit trail.
3. **No silent fields.** Every editable field in both modules is audited, including the four booleans in Module 1. A checkbox toggle is a state change an auditor cares about.
4. **Creates and deletes are logged, not just updates.** `CREATE` writes one summary row; `DELETE` writes a summary row *before* removal, plus an optional reason row (the existing OSC delete flow already does this well).
5. **Values are stored as display-normalised strings.** Booleans as `"Yes"`/`"No"`, dates as `yyyy-MM-dd`, enums as raw enum keys (the UI maps them via label tables). This matches the existing convention and keeps the history renderer free of per-type branching.

### 5.2 Shared helper (new file: `src/lib/audit.ts`)

```ts
type FieldSpec = { key: string; type: 'string' | 'boolean' | 'date' | 'enum' }

/** Normalise a value to its audit string form. */
function norm(value: unknown, type: FieldSpec['type']): string | null {
  if (value === null || value === undefined || value === '') return null
  if (type === 'boolean') return value ? 'Yes' : 'No'
  if (type === 'date')    return new Date(value as string).toISOString().split('T')[0]
  return String(value)
}

/** Diff two records into audit rows. Only changed fields are returned. */
export function diffFields(
  before: Record<string, unknown>,
  after:  Record<string, unknown>,
  specs:  readonly FieldSpec[],
): Array<{ fieldChanged: string; oldValue: string | null; newValue: string | null }>

/** Build AuditLog createMany input. Call inside the mutation's $transaction. */
export function auditRows(args: {
  entity: AuditEntity
  entityId: string
  entityLabel: string
  userId: string
  action: AuditAction
  changes?: ReturnType<typeof diffFields>
}): Prisma.AuditLogCreateManyInput[]
```

Usage mirrors the proven pattern at [route.ts:44-95](src/app/api/osc/[id]/route.ts#L44-L95):

```ts
const changes = diffFields(existing, next, DESIGN_SESSION_FIELDS)

const [updated] = await prisma.$transaction([
  prisma.designSession.update({ where: { id }, data: next }),
  prisma.auditLog.createMany({
    data: auditRows({
      entity: 'DESIGN_SESSION', entityId: id, entityLabel: next.popZone,
      userId: session.user.id, action: 'UPDATE', changes,
    }),
  }),
])
```

Two improvements over the current OSC implementation, both worth adopting:

- The existing code hardcodes its audited field list twice (once for strings, once for dates) and **omits `partnerId`** — partner changes are not logged, despite `FIELD_LABELS` in the history page having an entry for it. A declarative `FieldSpec[]` per module prevents that class of drift.
- `createMany` replaces N individual `create` calls in the transaction array — one round trip instead of one per changed field.

### 5.3 Detail-view timeline component

Generalise [osc-timeline.tsx](src/components/osc/osc-timeline.tsx) into `src/components/shared/audit-timeline.tsx`:

- Accept `entries: AuditEntry[]` and an optional `comments` slot, rather than importing `OscComment` / `OscHistory` Prisma types directly.
- Accept a `fieldLabels: Record<string, string>` prop instead of the module-specific `formatFieldName` map currently inlined at [osc-timeline.tsx:21-28](src/components/osc/osc-timeline.tsx#L21-L28).
- Same visual treatment: avatar, actor name, role lozenge, `old → new` chips, right-aligned `dd/MM/yyyy HH:mm`.
- Newest-last ordering to match the OSC detail view (`orderBy: { changedAt: 'asc' }`).

Refactoring the OSC module to consume the shared component is **optional and out of scope** — it works today. Ship the shared component for the new modules; migrate OSC opportunistically.

Note: neither new module requires comments per the brief. The component should keep the comment slot optional so `DesignSessionComment` / `AddressRequestComment` can be added later without a rewrite. Do not build comment tables now.

### 5.4 Unified Change History page

Extend [page.tsx](src/app/history/page.tsx) with a module tab strip: **OSC Requests · Design Sessions · Addresses**.

- Tabs render only where the user holds the matching `audit:read:*` capability. `WM_SUPPORT_ENGINEER` sees two tabs; `EXTERN` sees the page not at all.
- Default tab = the first tab the user can see (not hardcoded to OSC).
- **Server-side enforcement is mandatory**, not just tab hiding: the `entity` query param must be validated against capability before the query runs. A `WM_SUPPORT_ENGINEER` hitting `/history?entity=OSC_REQUEST` must get a redirect, not OSC data.
- Existing filters (user, date range, free-text on the entity label) carry over. The `popzone` param generalises to `label`.
- The OSC tab keeps querying `oscHistory`; the two new tabs query `auditLog` filtered by `entity`. Two code paths, one page — acceptable, and avoids touching proven OSC behaviour.
- Reuse the existing `PAGE_SIZE = 50` and pagination markup unchanged.

### 5.5 Retention

Not specified in the brief, and not needed for launch. But `AuditLog` is the fastest-growing table in the system: four boolean toggles per Design Session across ~433 POP zones, plus script ingest, will outpace `OscHistory` quickly. Add the `@@index([changedAt])` now (§3.5) so a retention sweep is cheap later, and raise retention policy with the business before the table crosses ~10M rows. No code required at launch.

---

## 6. Module 1 — Design Session Tracker

**Purpose:** manage and monitor POP zone design sessions.
**Routes:** `/design-sessions`, `/design-sessions/new`, `/design-sessions/[id]`, `/design-sessions/[id]/edit`

### 6.1 Fields

| Field | Column | Type | Editable | Validation |
|---|---|---|---|---|
| POP Zone | `popZone` | Text | On create only¹ | Required, 3–64 chars, `/^[A-Z0-9_]+$/i`, unique (case-insensitive) |
| Cabinet Name | `cabinetName` | Text | ✅ | Optional, ≤64 chars |
| MRO Partner | `mroPartner` | Text | ✅ | Optional, ≤64 chars |
| Notes | `notes` | Long text | ✅ | Optional, ≤5000 chars |
| Actions Done | `actionsDone` | Long text | ✅ | Optional, ≤5000 chars |
| OSC Status | *(derived)* | Lookup | ❌ Read-only | See §6.4 |
| Send OC Request to Partner | `sendOcRequestToPartner` | Boolean | ✅ | — |
| AAP on Hold | `aapOnHold` | Boolean | ✅ | — |
| Ready to Post | `readyToPost` | Boolean | ✅ | — |
| Posted | `posted` | Boolean | ✅ | See §6.6 |

¹ **POP Zone is immutable after creation.** It is the identity of the record, the join key to OSC Status, and the link key for script executions. Editing it would silently re-point both. Admins can delete and recreate; the audit log records both events. *Alternative if the business needs corrections: allow edit for `ADMIN` only, and on change, re-resolve `designSessionId` on all `ScriptExecution` rows for both the old and new key inside the same transaction.*

### 6.2 List view

Columns: `POP Zone · Cabinet · MRO Partner · OSC Status · Stage · ☑ OC Req · ☑ AAP Hold · ☑ Ready · ☑ Posted · Updated`

- **Stage** is a derived, non-persisted column summarising the four booleans into one lozenge (§6.6). It is what makes the list scannable — four checkbox columns are not.
- Sortable: POP Zone, Cabinet, MRO Partner, Stage, Updated. Follow the `buildOrderBy(sort, dir)` pattern at [page.tsx:26](src/app/osc/page.tsx#L26), including `nulls: 'last'`.
- Default sort: `posted asc`, then `updatedAt desc` — un-posted work first.
- Filters: free-text search (POP Zone + Cabinet), MRO Partner (select, distinct values), Stage, and a "Hide posted" toggle on by default.
- `PAGE_SIZE = 25`, matching the OSC list.
- Booleans render as a check/dash icon, **and are inline-editable** for users with `design:write` — see §6.3.
- Row click → detail view. The click target is the row, not just the POP Zone cell.
- Empty state per the existing pattern: icon in a rounded square, "No design sessions found", hint line.

### 6.3 Inline boolean editing

The four booleans are the primary working surface of this module — requiring a round trip to an edit form to tick "Posted" would make the dashboard unusable at 433 rows. Behaviour:

- Checkbox is interactive in the list for `design:write`; static icon otherwise.
- Click → optimistic UI update → `PATCH /api/design-sessions/[id]/flags` → on error, revert and toast.
- Each toggle writes an audit row. Rapid toggling produces multiple rows; that is correct — do not debounce writes, only debounce the network call within a single interaction.
- Concurrency: include the row's `updatedAt` as a precondition (§10.1). If it fails, revert and toast "This record changed — refresh to see the latest".

### 6.4 OSC Status projection (the §1.2 problem)

The brief specifies *"dynamically fetched from the existing OSC Tracker database based on the current record"*. Since `popzone` is not *enforced* unique (see the corrected §1.2 — currently 1:1 in live data, but nothing prevents duplicates), this needs an explicit rule.

**Disambiguation rule — most recently active OSC request for the POP zone:**

```
match:  upper(btrim(OscRequest.popzone)) = DesignSession.popZoneKey
order:  coalesce(updatedDate, oscRequestDate, receivedDate, createdAt) DESC, createdAt DESC
take:   1
```

The `coalesce` chain mirrors how the OSC list itself ranks recency ([page.tsx:44-49](src/app/osc/page.tsx#L44-L49)). Prisma cannot express `orderBy` over a `coalesce`, so:

- **List view:** one batched query — `findMany` all `OscRequest` rows whose normalised popzone is in the current page's ≤25 keys, then reduce in JS to pick the winner per key. One query per page render, **never N+1**. With `@@index([popzone])` this is a cheap index scan.
- **Detail view:** fetch all matches for the single POP zone (typically ~4 rows), reduce in JS. This also supplies the match count for the UI below.

**UI presentation:**

| Case | Display |
|---|---|
| Exactly 1 match | `StatusLozenge` for that request |
| >1 match | `StatusLozenge` of the most recent + muted caption `"most recent of N requests"` |
| 0 matches | `—` with tooltip `"No OSC request found for this POP zone"` |

The match count is only rendered when it exceeds 1, so on today's 1:1 data it never appears. It exists so that if duplicates do reappear, a support engineer is not shown a lone "Email Sent" lozenge while three other requests for that zone sit unmentioned.

**Optional follow-up, now that the data is clean:** add `@@unique([popZoneKey])`-style enforcement to `OscRequest` (a unique index on `upper(btrim(popzone))`) and a duplicate check in `POST /api/osc`. That would make the 1:1 relationship a guarantee rather than a convention, at which point this projection could collapse to a plain join. Out of scope here — it changes OSC module behaviour, which this change set otherwise leaves alone.

The caption links to `/osc?search=<popZone>` for roles holding `osc:read` — which, after A4 was reversed, includes `WM_SUPPORT_ENGINEER`. The guard stays for any future role granted `design:read` without `osc:read`.

**Not denormalised.** No `oscStatusCache` column. At 433 zones a live projection is correct and always accurate; a cache would need invalidation on every OSC request write and would drift. Revisit only if the list exceeds ~5k rows, at which point add `oscStatusCache` + `oscStatusSyncedAt` updated by a job — but do not build it now.

### 6.5 Scripts list (the §1.7 gap)

**The data does not exist yet.** This sub-feature is a new ingestion pipeline, and it is the largest single item in the spec. Flagging clearly: if the schedule is tight, ship Modules 1 and 2 without it (Phases 1–3) and add scripts in Phase 4. The detail view should render an explicit "No script executions recorded" empty state, which is honest rather than broken.

**Display** (detail view, left column, below Actions Done):

Table: `Script Name · Version · Status · Executed At · Duration · Executed By`

- Ordered `executedAt desc`, most recent first.
- Status as a lozenge: `SUCCESS` emerald, `FAILED` red, `PARTIAL` amber, `RUNNING` blue (reuse the `STATUS_LOZENGE` colour vocabulary from [utils.ts:29](src/lib/utils.ts#L29)).
- Row expands to reveal `output`, in a monospace block, collapsed by default.
- Capped at 50 most recent with a "show all" affordance — a POP zone with hundreds of runs must not blow up the page.
- Read-only for every role. Scripts are ingested, never hand-edited. No audit trail on `ScriptExecution` itself: it is already an immutable event log.

**Ingestion** — `POST /api/v1/script-executions`, authenticated by the existing daily-rotating API key ([api-key.ts](src/lib/api-key.ts)), matching the `/api/v1/osc-requests` precedent:

```jsonc
{
  "popZone":     "MRO_HAALTERT_01_POP_011",   // required; normalised server-side
  "scriptName":  "aap_validation.py",          // required
  "scriptVersion": "1.4.2",
  "status":      "SUCCESS",                    // required; ScriptStatus
  "executedAt":  "2026-08-03T09:14:22Z",       // required; ISO 8601
  "durationMs":  8421,
  "output":      "…",                          // truncated to 64 KB server-side
  "executedByLabel": "ci-runner-03",
  "externalRef": "run-2026-08-03-8871"         // idempotency key
}
```

- Accepts a single object or an array (batch ≤500).
- `externalRef` present and already seen → `200` no-op. Absent → always inserts. Idempotency is opt-in by the caller but strongly recommended.
- Resolves `designSessionId` from `popZoneKey`; leaves it null if no session exists yet, and does **not** create one implicitly.
- Rate-limited via the existing [rate-limit.ts](src/lib/rate-limit.ts).
- `output` truncation happens at ingest, before insert — an unbounded `@db.Text` fed by CI logs is a storage incident waiting to happen. Truncate at 64 KB with a `"… [truncated]"` marker.

**Open question for the business:** what actually runs these scripts, and can it POST? If the runner cannot be modified, the fallback is an XLSX bulk upload mirroring [bulk-upload-form.tsx](src/components/osc/bulk-upload-form.tsx) — more work, and stale by definition. Settle this before Phase 4 starts.

### 6.6 Derived stage and boolean interaction logic

The four booleans encode an implicit lifecycle. Making it explicit is what turns a checkbox grid into a tracker.

```
Design → OC Requested → [AAP on Hold] → Ready to Post → Posted
```

**Derived stage** (display only, computed, never stored — a stored copy would drift):

| Condition (first match wins) | Stage | Lozenge |
|---|---|---|
| `posted` | Posted | emerald |
| `aapOnHold` | AAP on Hold | amber |
| `readyToPost` | Ready to Post | blue |
| `sendOcRequestToPartner` | OC Requested | zinc |
| otherwise | In Design | zinc (muted) |

`posted` takes precedence over `aapOnHold` deliberately: a posted record that still carries a stale hold flag should read as Posted, not Blocked.

**Interaction rules:**

- `posted = true` while `readyToPost = false` → auto-set `readyToPost = true`, and write **both** audit rows (the second attributed to the same user and timestamp). Posting implies readiness; forcing two clicks invites inconsistent data.
- `readyToPost = false` while `posted = true` → block, with the message *"Un-tick Posted first."* This is the one hard validation; the rest are advisory.
- `aapOnHold = true` while `readyToPost = true` → allow, but warn: *"This session is marked ready to post."* Holds legitimately arrive late; blocking would fight reality.
- `posted = true` while `aapOnHold = true` → allow, warn: *"AAP is still on hold."*
- No auto-clearing of `aapOnHold` on post. Do not infer state the user did not set.

All auto-set and blocked transitions must be covered by tests (§11) — this is the module's only real business logic and the easiest place for a regression to hide.

### 6.7 Detail view layout

Follow the two-column structure of [page.tsx](src/app/osc/[id]/page.tsx) — it already solves this exact problem:

```
Breadcrumb: Design Sessions › MRO_HAALTERT_01_POP_011

┌─ Left (flex-1) ───────────────────────┐  ┌─ Right (w-60) ──────┐
│ H1: POP Zone      [Edit] [Delete*]    │  │ OSC Status  ← lookup│
│                                       │  │ Stage               │
│ Panel: Notes                          │  │ Cabinet Name        │
│ Panel: Actions Done                   │  │ MRO Partner         │
│                                       │  │ ─────────────────── │
│ Panel: Script Executions   §6.5       │  │ ☑ Send OC Request   │
│   (table, expandable rows)            │  │ ☑ AAP on Hold       │
│                                       │  │ ☑ Ready to Post     │
│ Panel: History  ← AuditTimeline §5.3  │  │ ☑ Posted            │
│                                       │  │ ─────────────────── │
│                                       │  │ Created By / At     │
│                                       │  │ Last Updated        │
└───────────────────────────────────────┘  └─────────────────────┘
```

`[Delete*]` renders only for `design:delete` (ADMIN). Deletion requires a typed reason, following the existing OSC delete flow which records both a `deleted` and a `deleteReason` audit row.

Use `unstable_noStore()` in the page, as the OSC detail page does — the OSC Status projection must never be served stale from the Next.js cache.

---

## 7. Module 2 — Addresses Tracker

**Purpose:** manage address-related operational requests.
**Routes:** `/addresses`, `/addresses/new`, `/addresses/[id]`, `/addresses/[id]/edit`

### 7.1 Fields

| Field | Column | Type | Editable | Validation |
|---|---|---|---|---|
| Request Date | `requestDate` | Date | ✅ | Required, not more than 1 day in the future |
| Reporter | `reporter` | Text | ✅ | Required, 2–128 chars |
| Tina_UUID | `tinaUuid` | Text | ✅ | Optional; UUID format if it parses as one, else free text ≤64 |
| AAP_ID | `aapId` | Text | ✅ | Optional, ≤64 chars |
| Status | `status` | Enum | ✅ | Required; `NOT_STARTED` \| `ON_HOLD` \| `BLOCKED` \| `COMPLETED` |
| Notes | `notes` | Long text | ✅ | Optional, ≤5000 chars |
| Date of Completion | `completionDate` | Date | ✅ (conditional) | Required iff `status = COMPLETED`; ≥ `requestDate` |

Cross-field rule: **at least one of `tinaUuid` / `aapId` must be present** (assumption A2). Enforced in zod via `.refine()` *and* by the DB CHECK constraint in §3.5 — the constraint is the backstop for bulk imports and any future API path that bypasses the zod schema.

### 7.2 Status vocabulary

Displayed in the brief's order, which is *not* lifecycle order. Use lifecycle order in the UI (`Not Started → On Hold → Blocked → Completed`) and add to `utils.ts`:

```ts
export const ADDRESS_STATUS_LABELS: Record<AddressRequestStatus, string> = {
  NOT_STARTED: 'Not Started',
  ON_HOLD:     'On Hold',
  BLOCKED:     'Blocked',
  COMPLETED:   'Completed',
}

export const ADDRESS_STATUS_LOZENGE: Record<AddressRequestStatus, string> = {
  NOT_STARTED: /* zinc   */, ON_HOLD: /* amber */,
  BLOCKED:     /* red    */, COMPLETED: /* emerald */,
}
```

Colours reuse the existing `STATUS_LOZENGE` vocabulary so `BLOCKED` reads with the same urgency as `CHECK_REMARKS`. Typing both as `Record<AddressRequestStatus, …>` means a future status is a compile error, consistent with §4.4's approach.

### 7.3 List view

Columns: `Request Date · Reporter · Tina UUID / AAP ID · Status · Age · Completion Date`

- **Tina UUID / AAP ID** render in one column as two stacked chips, labelled, so it is unambiguous which identifier is present. Whichever is null is omitted, not shown as `—`.
- **Age** is derived: days between `requestDate` and (`completionDate` ?? today). Highlight amber >14 days, red >30 days, for non-completed rows only. This is the column that makes the tracker operationally useful — a flat list of dates does not surface ageing work.
- Sortable: Request Date, Reporter, Status, Age, Completion Date. Default: `status` (open first), then `requestDate desc`.
- Filters: free text (Reporter, Tina UUID, AAP ID), Status multi-select, request-date range, "Hide completed" toggle on by default.
- Status is **inline-editable** via a select for `address:write`, same optimistic pattern as §6.3 — with the §7.4 completion-date interaction handled as described.
- `PAGE_SIZE = 25`.

### 7.4 Status ↔ completion date interaction

The only real business logic in this module:

- Setting `status = COMPLETED` with no `completionDate` → default it to **today**, pre-filled and editable in the form. From the *inline* list editor there is no form, so set it to today automatically and write both audit rows.
- Setting `status = COMPLETED` with a `completionDate` earlier than `requestDate` → validation error.
- Changing `status` *away* from `COMPLETED` → prompt: *"Clear the completion date?"* Default **yes**. Clearing writes its own audit row. Leaving a completion date on a non-completed record is exactly the kind of quiet inconsistency that erodes trust in a tracker.
- `completionDate` is editable while `status = COMPLETED` (back-dating a completion is legitimate).
- The DB CHECK constraint (§3.5) guarantees the invariant even if a future code path forgets.

### 7.5 Detail view layout

Same two-column shell as §6.7, simplified — no scripts panel:

- **Left:** H1 (`Tina UUID` ?? `AAP ID`, whichever is present), `[Edit]` / `[Delete*]`, Notes panel, History panel (`AuditTimeline`).
- **Right:** Status, Age, Request Date, Completion Date, Reporter, Tina UUID, AAP ID, Created By/At, Last Updated.

---

## 8. API surface

All routes: `401` unauthenticated, `403` on capability failure, `400` on zod failure with `{ error, details: flatten() }` — matching the existing convention at [route.ts:36](src/app/api/osc/[id]/route.ts#L36). All mutations write audit rows in the same transaction.

| Method | Route | Capability | Notes |
|---|---|---|---|
| `GET` | `/api/design-sessions` | `design:read` | List; query params mirror §6.2 filters. Includes batched OSC Status projection |
| `POST` | `/api/design-sessions` | `design:write` | Create. `409` on duplicate `popZoneKey`. Back-fills `ScriptExecution.designSessionId` |
| `GET` | `/api/design-sessions/[id]` | `design:read` | Detail + scripts + audit + OSC Status |
| `PUT` | `/api/design-sessions/[id]` | `design:write` | Full update. `popZone` immutable (§6.1). `updatedAt` precondition |
| `PATCH` | `/api/design-sessions/[id]/flags` | `design:write` | Boolean toggles only. Applies §6.6 rules. `updatedAt` precondition |
| `DELETE` | `/api/design-sessions/[id]` | `design:delete` | Requires `{ reason }`. Audit rows before delete |
| `POST` | `/api/design-sessions/bulk` | `design:write` | XLSX import, upsert on `popZoneKey` (§10.3) |
| `GET` | `/api/design-sessions/bulk` | `design:write` | Blank XLSX template, per the `/api/osc/bulk` GET precedent |
| `GET` | `/api/addresses` | `address:read` | List; filters per §7.3 |
| `POST` | `/api/addresses` | `address:write` | Create |
| `GET` | `/api/addresses/[id]` | `address:read` | Detail + audit |
| `PUT` | `/api/addresses/[id]` | `address:write` | Full update. Applies §7.4 rules. `updatedAt` precondition |
| `PATCH` | `/api/addresses/[id]/status` | `address:write` | Inline status change. Applies §7.4 |
| `DELETE` | `/api/addresses/[id]` | `address:delete` | Requires `{ reason }` |
| `GET` | `/api/audit` | `audit:read:*` | Paged audit feed. `entity` param **validated against capability** (§5.4) |
| `POST` | `/api/v1/script-executions` | API key | Ingest (§6.5). Rate-limited. Idempotent on `externalRef` |

New zod schemas in [validations.ts](src/lib/validations.ts): `designSessionCreateSchema`, `designSessionUpdateSchema`, `designSessionFlagsSchema`, `addressRequestSchema`, `scriptExecutionIngestSchema`. Export inferred types alongside, matching the file's existing convention.

---

## 9. UI/UX conformance

Everything follows [DESIGN.md](DESIGN.md). Load-bearing points for this work:

- **No new visual vocabulary.** Both modules reuse `jira-panel`, `jira-btn-secondary`, `jira-input`, the `Lozenge` primitives, table header/row/hover treatments, and the two-column detail shell. A support engineer moving between OSC Requests and Design Sessions should not notice a seam.
- **Tables:** uppercase 11px `#a1a1aa` headers on `#fafafa`, 1px `#f0f0f2` row borders, sticky header, `tabular-nums` on all dates and counts.
- **Lozenges:** text only, no icons, `rounded-[5px]`, 1px inset ring for colour variants.
- **Skeletons, not spinners.** Add `loading.tsx` for both list routes, mirroring [loading.tsx](src/app/osc/loading.tsx).
- **Icons:** Lucide, stroke 1.5. `LayoutGrid` for Design Sessions, `MapPin` for Addresses, `Terminal` for the scripts panel.
- **Light mode only.** Dark mode was deliberately reverted (commits `92ea3ce`, `c609329`). `utils.ts` still carries `dark:` variants in its lozenge tokens — harmless, but do not add new ones or re-introduce a toggle.
- **Boolean cells** use a check icon in accent blue and an em-dash in `#a1a1aa` — never raw `true`/`false`, never emoji.
- **Reduced motion:** optimistic toggles must not animate under `prefers-reduced-motion: reduce`.

Accessibility, since both list views are now interactive surfaces rather than read-only tables:

- Inline checkboxes and status selects need real `<input>` / `<select>` elements with `aria-label` naming the record (`"Posted — MRO_HAALTERT_01_POP_011"`). Do not build them from clickable `<div>`s.
- Row-click navigation must not swallow keyboard focus from the inline controls inside the row. The controls need `stopPropagation` on click and their own tab stops.
- Optimistic failures announce via an `aria-live="polite"` region, not a toast alone.
- Colour is never the only signal: the Age column shows the day count as text, not just an amber/red tint.

---

## 10. Edge cases and non-functional requirements

### 10.1 Concurrent edits

Two Wyer/Merkator engineers working the same queue will collide, and the platform currently has **no protection at all** — [route.ts](src/app/api/osc/[id]/route.ts) `PUT` is last-write-wins with a silently misleading audit trail (both users' rows land, so the log implies a sequence that never logically happened).

For the new modules, require an optimistic-concurrency precondition:

- Client sends the `updatedAt` it loaded.
- Server compares before writing, inside the transaction.
- Mismatch → `409 Conflict` with the current record in the body.
- UI shows *"This record was changed by <name> while you were editing"* and offers reload.

This matters most for the inline toggles (§6.3) and inline status edits (§7.4), where the edit window is short but the traffic is high. Retro-fitting it to the OSC module is out of scope but recommended.

### 10.2 POP zone normalisation

- Normalise to `upper(trim())` on write into `popZoneKey`; store the user's original casing in `popZone` for display.
- Uniqueness is enforced on the normalised key, so `mro_haaltert_01_pop_011` and `MRO_HAALTERT_01_POP_011` collide correctly.
- The OSC-side match uses the expression index from §3.5 to normalise the other side of the join at query time.
- Validation rejects internal whitespace but does **not** enforce the `MRO_<CITY>_<NN>_POP_<NNN>` shape — it only warns. This decision was vindicated when the soft pattern was calibrated against the live data: **21 of 433 real POP zones do not match the naive shape**, in two legitimate families —
  - hyphenated Belgian place names (19): `MRO_MOLENBEEK-SAINT-JEAN_07_POP_002`, `MRO_SINT-ANTELINKS_01_POP_001`
  - a trailing split-POP letter (2): `MRO_MECHELEN_03_POP_008_A`

  A hard regex would have rejected all 21. `isUnusualPopZone` now accepts both families (0 false positives across 433) while still flagging genuinely malformed input such as `CABINET_123` or `MRO_GENK_1_POP_1`.

### 10.3 Bulk import (Design Sessions)

Mirror [bulk-upload-form.tsx](src/components/osc/bulk-upload-form.tsx) and `/api/osc/bulk`, with the lesson of commit `4e9f4df` applied from the start:

- **Upsert on `popZoneKey`**, never blind insert. This is precisely the duplicate bug already fixed once in the OSC importer.
- Booleans parse from `Yes/No`, `TRUE/FALSE`, `1/0`, and empty (→ false), case-insensitive.
- Row-level validation with a per-row error report and inline correction, as the OSC importer already does.
- Audit: one `CREATE` row per new record; a normal field-level diff for each updated record. A bulk import that overwrites 300 records must be as auditable as 300 manual edits — this is the audit trail's hardest requirement and the easiest to get wrong.
- Attribute all rows to the importing user with a single timestamp per import batch.

Dependency note: `xlsx@0.18.5` is declared in **devDependencies** ([package.json:65](package.json#L65)) but imported by runtime code ([route.ts](src/app/api/osc/bulk/route.ts)). It works today because Next.js bundles it at build time, but any production install using `--omit=dev` will fail the build. Module 1's importer inherits this. Move it to `dependencies` during Phase 3.

### 10.4 Performance

- Design Session list: 2 queries per render (page of sessions + batched OSC projection), independent of page size. Assert this in a test — an N+1 here is the most likely performance regression.
- All list queries paginate. No unbounded `findMany` anywhere.
- Scripts panel caps at 50 rows.
- `AuditLog` is queried only by indexed predicates (`[entity, entityId, changedAt]` for detail, `[entity, changedAt]` for the history page).
- `noStore()` on detail pages; list pages may use default caching since all mutations trigger a router refresh.

### 10.5 Data volume estimate

| Table | Year-1 estimate | Basis |
|---|---|---|
| `DesignSession` | ~400–1,000 | 433 distinct POP zones in the live database |
| `AddressRequest` | unknown | ⚠ No baseline exists — ask the business for expected monthly volume |
| `ScriptExecution` | 10k–100k | Entirely dependent on the runner's cadence; the widest unknown in the spec |
| `AuditLog` | 50k–500k | Dominated by boolean toggles and bulk imports |

`ScriptExecution.output` at `@db.Text` is the storage risk. The 64 KB ingest truncation (§6.5) is what keeps this bounded; without it, 100k CI logs is unbounded growth.

---

## 11. Acceptance criteria

**Role and RBAC**
- [ ] A `WM_SUPPORT_ENGINEER` can list, view, create and edit records in both new modules.
- [ ] A `WM_SUPPORT_ENGINEER` can create, edit and delete OSC requests, design sessions and address requests, and can comment on an OSC request (A4/A6, both reversed).
- [ ] A `WM_SUPPORT_ENGINEER` is still redirected away from `/users` and `/api-integration`, and never sees the data-API key. *(The grant is broad but bounded — this is what remains of the §1.1 regression test.)*
- [ ] An `EXTERN` user is redirected away from `/api-integration` and never sees the data-API key.
- [ ] An `EXTERN` user cannot reach either new module (UI or API).
- [ ] The role's label and lozenge render correctly in the sidebar, user management, and audit rows — no `undefined`.
- [ ] An admin can assign the role from the user form.
- [ ] Adding a hypothetical 5th role to the `Role` enum fails `tsc` until `MATRIX`, `ROLE_LABELS` and `ROLE_LOZENGE` are updated.

**Audit trail (both modules)**
- [ ] Every editable field, including all four booleans, produces an audit row with actor, timestamp, old and new value.
- [ ] Create and delete produce audit rows; delete rows are written before removal and survive it with a readable `entityLabel`.
- [ ] A failed mutation writes **no** audit rows (transaction rollback verified).
- [ ] The detail view shows the complete log, oldest-first, with actor name and role.
- [ ] A bulk import of 300 rows produces a complete, correctly attributed audit trail.
- [ ] Audit rows remain readable after their subject record is deleted.

**Module 1**
- [ ] OSC Status resolves via the §6.4 rule; a POP zone with 4 OSC requests shows the most recent status **and** the count.
- [ ] A POP zone with no OSC request shows `—`, not an error or a blank cell.
- [ ] The list renders 25 rows with OSC Status in a bounded number of queries (no N+1).
- [ ] `posted = true` auto-sets `readyToPost` and writes both audit rows.
- [ ] `readyToPost = false` while `posted = true` is rejected with the specified message.
- [ ] Inline toggles update optimistically and revert with a message on `409`.
- [ ] Duplicate POP zone (any casing) is rejected with `409`.
- [ ] Scripts panel lists executions for the POP zone, newest first, with a correct empty state.
- [ ] A script POSTed before its Design Session exists appears in the detail view once the session is created.
- [ ] Re-POSTing the same `externalRef` does not duplicate.

**Module 2**
- [ ] A record with neither Tina UUID nor AAP ID is rejected by both zod and the DB constraint.
- [ ] `status = COMPLETED` defaults `completionDate` to today; a completion date before the request date is rejected.
- [ ] Moving away from `COMPLETED` prompts to clear the date and audits the clear.
- [ ] Age highlights amber >14 days and red >30 days, for open records only.

---

## 12. Delivery plan

Sequenced so the security prerequisite lands first and each phase is independently shippable.

| Phase | Scope | Why here |
|---|---|---|
| **1 — Foundations** | `permissions.ts`; migrate all 12 existing role checks (§4.3); re-type `ROLE_LABELS`/`ROLE_LOZENGE`; adopt versioned migrations; add the `Role` enum value in its own migration; middleware matcher; capability-driven sidebar; seed a QA user | **Blocking.** Ships no features but closes §1.1 before the new role can exploit it. Verifiable by the RBAC regression tests alone. |
| **2 — Addresses Tracker** | `AddressRequest` model + CHECK constraints; full CRUD; `audit.ts` + `AuditLog`; `AuditTimeline`; list/detail/edit; history tab | Simpler of the two modules and it exercises the whole audit stack end-to-end. Proves the shared foundation before Module 1 depends on it. |
| **3 — Design Session Tracker** | `DesignSession` model; CRUD; boolean lifecycle (§6.6); inline toggles; OSC Status projection (§6.4) + `OscRequest` indexes; bulk XLSX import; history tab | Depends on Phase 2's audit helper and timeline. Scripts panel ships as an empty state. |
| **4 — Script executions** | `ScriptExecution` model; `/api/v1/script-executions` ingest; scripts panel; back-fill on session create | **Separable.** Blocked on the §6.5 open question about what runs the scripts and whether it can POST. Deferring this does not hold up anything else. |

**Critical path risks**

1. **Phase 1 is not optional and not cosmetic.** Shipping the enum value before the denylist→allowlist migration hands OSC delete rights to the new role. If Phase 1 slips, the role slips with it.
2. **Phase 4 has an unresolved external dependency.** Settle the script-runner question before committing to a date, or scope it out explicitly.
3. **Assumptions A1 and A2** (§2) should be confirmed before Phase 2/3 migrations run. Both are one-line schema changes now and data migrations later.
4. **No test infrastructure exists** in this repo — no test runner in `package.json`, no test files. The acceptance criteria in §11, particularly the RBAC regression tests, need a runner (Vitest + a test database) stood up during Phase 1. That is unbudgeted work in this spec and should be sized separately.

---

## 13. Applying this change set

The code is implemented and builds clean (`tsc`, `next lint`, `next build`), plus
`npm run verify` (51 pure-logic assertions, no database needed — RBAC, the flag
lifecycle, the completion invariant, and audit diffing).

Migrations were **generated but not applied** — `DATABASE_URL` points at the
Docker-internal `postgres` host and `DIRECT_URL` is unset, so the database is not
reachable from a host shell. Apply them yourself, in this order.

### 13.1 One-time: set `DIRECT_URL`

`prisma/schema.prisma` has always declared `directUrl = env("DIRECT_URL")`, but
the variable was absent from `.env.example` and from `.env` — every Prisma CLI
command fails with `P1012` until it is set. It is now documented in
`.env.example`; add it to your `.env` (same value as `DATABASE_URL` when you are
not using a connection pooler).

### 13.2 Baseline the existing database

The project has been on `db push`, so `prisma/migrations/` was empty while the
database already had every table. `0_init/migration.sql` is the generated
equivalent of the pre-change schema — mark it as already applied rather than
running it:

```bash
npx prisma migrate resolve --applied 0_init
```

Run this **once**, against each existing environment (dev, staging, production).
Skip it only for a brand-new empty database, where `migrate deploy` should run
`0_init` for real.

### 13.3 Apply the two new migrations

```bash
npx prisma migrate deploy
```

This applies, in order:

1. `20260803000001_add_wm_support_engineer_role` — `ALTER TYPE "Role" ADD VALUE`,
   isolated so nothing references the new value in the same transaction.
2. `20260803000002_wyer_merkator_modules` — the four new tables, all indexes,
   the two `OscRequest` indexes, the `upper(btrim(popzone))` expression index,
   and the two `AddressRequest` CHECK constraints.

**Do not use `npm run db:push` for this change set.** The expression index and
both CHECK constraints are not expressible in `schema.prisma`, so a push would
silently drop them.

### 13.4 Optional: seed a QA user

```bash
WM_SEED_PASSWORD='<a strong password>' ADMIN_SEED_PASSWORD='<existing>' npm run db:seed
```

Creates `wm.support@mdesign.ma` with the new role. Skipped when
`WM_SEED_PASSWORD` is unset, so production seeds are unaffected.

### 13.5 Post-deploy verification

- `npm run verify` — capability matrix and business rules.
- Sign in as the Wyer/Merkator user: the sidebar should show **Design Sessions**,
  **Addresses**, **Change History**, **Settings** — and no Dashboard, OSC
  Requests, User Management, or API Integration.
- Confirm that user can open `/osc`, `/dashboard` and all three `/history` tabs,
  can edit and delete an OSC request, and that `/users` and `/api-integration`
  both redirect to `/design-sessions`.
