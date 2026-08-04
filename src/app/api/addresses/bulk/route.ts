import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/api-auth'
import * as XLSX from 'xlsx'
import { Prisma, AddressRequestStatus } from '@prisma/client'
import { auditRows, diffFields, initialFields, ADDRESS_REQUEST_FIELDS } from '@/lib/audit'
import { addressLabel, resolveCompletion, validateAddressRecord } from '@/lib/addresses'
import { ADDRESS_STATUS_LABELS, ADDRESS_STATUS_ORDER } from '@/lib/utils'

// Bulk XLSX import for address requests, following /api/design-sessions/bulk.
//
// Two things differ from that importer, both forced by this table's shape:
//
//   1. There is no unique key to upsert on. `tinaUuid` and `aapId` are indexed
//      but nullable and non-unique (§3.5), so a row is matched against EITHER
//      identifier and a row that matches more than one stored request is
//      reported rather than resolved — picking one arbitrarily would silently
//      overwrite the wrong record.
//   2. A blank cell means "leave unchanged", not "clear". `requestDate` and
//      `reporter` are NOT NULL, so blank-means-null is not even expressible for
//      them; making the rule uniform across every column is more predictable
//      than a per-column split. The consequence — notes cannot be cleared from
//      a spreadsheet — is stated in the UI.
//
// Audit: a run that overwrites 300 rows is as auditable as 300 manual edits.
// See SPEC-WYER-MERKATOR.md §10.3.

const COLUMNS = [
  'Request Date', 'Reporter', 'Tina UUID', 'AAP ID', 'Status', 'Notes', 'Date of Completion',
] as const

const MAX_ROWS = 1000
const MAX_BYTES = 5 * 1024 * 1024

const STATUS_LABEL_LIST = ADDRESS_STATUS_ORDER.map((s) => ADDRESS_STATUS_LABELS[s]).join(', ')

/** Loose on case, spaces and underscores, so 'not started' matches NOT_STARTED. */
function statusKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

// The enum names are the normalised form of the display labels, so one map
// keyed on statusKey() accepts both spellings.
const STATUS_BY_KEY = new Map<string, AddressRequestStatus>(
  ADDRESS_STATUS_ORDER.flatMap((s) => [
    [s as string, s] as [string, AddressRequestStatus],
    [statusKey(ADDRESS_STATUS_LABELS[s]), s] as [string, AddressRequestStatus],
  ]),
)

/** UTC midnight, matching the date-only storage convention (spec A8). */
function utcDate(year: number, month: number, day: number): Date | null {
  const d = new Date(Date.UTC(year, month - 1, day))
  // Round-trip guards against rollover, so 31/02/2026 is rejected rather than
  // silently becoming 03/03/2026.
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? d
    : null
}

/** `null` for a blank cell, `'invalid'` for something that is not a date. */
function parseSheetDate(val: unknown): Date | null | 'invalid' {
  if (val === null || val === undefined) return null

  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return 'invalid'
    // xlsx builds real date cells in local time; read the local components back
    // so the stored UTC date is the one the user actually typed.
    return utcDate(val.getFullYear(), val.getMonth() + 1, val.getDate()) ?? 'invalid'
  }

  const s = String(val).trim()
  if (!s) return null

  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (dmy) return utcDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1])) ?? 'invalid'

  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) return utcDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3])) ?? 'invalid'

  return 'invalid'
}

interface RowError {
  row: number
  message: string
  field?: string
}

/** A row as it was read, before it is matched against the stored data. */
interface RawRow {
  rowNum: number
  tinaUuid: string
  aapId: string
  reporter: string
  statusRaw: string
  notes: string
  requestDateCell: unknown
  completionDateCell: unknown
}

/** The next state of one request, plus the record it targets (if any). */
interface ResolvedRow {
  rowNum: number
  existingId: string | null
  next: {
    requestDate: Date
    reporter: string
    tinaUuid: string | null
    aapId: string | null
    status: AddressRequestStatus
    notes: string | null
    completionDate: Date | null
  }
}

type ExistingRecord = {
  id: string
  requestDate: Date
  reporter: string
  tinaUuid: string | null
  aapId: string | null
  status: AddressRequestStatus
  notes: string | null
  completionDate: Date | null
}

// GET — blank template, mirroring the other two importers' affordance.
export async function GET() {
  const auth = await authorize('address:write')
  if (!auth.ok) return auth.response

  const wb = XLSX.utils.book_new()

  const ws = XLSX.utils.aoa_to_sheet([
    [...COLUMNS],
    [
      '04/08/2026', 'Jan Peeters', '550e8400-e29b-41d4-a716-446655440000', '',
      'Not Started', 'Example note', '',
    ],
  ])
  ws['!cols'] = [
    { wch: 14 }, { wch: 20 }, { wch: 38 }, { wch: 16 },
    { wch: 14 }, { wch: 40 }, { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Addresses')

  // xlsx@0.18 cannot write real dropdown validation, so the allowed values ship
  // as a reference sheet instead of being silently unstated.
  const ref = XLSX.utils.aoa_to_sheet([
    ['Column', 'Accepted values'],
    ['Request Date', 'dd/MM/yyyy or yyyy-MM-dd — required for new requests'],
    ['Reporter', '2 to 128 characters — required for new requests'],
    ['Tina UUID', 'Up to 64 characters'],
    ['AAP ID', 'Up to 64 characters'],
    ['Status', STATUS_LABEL_LIST],
    ['Notes', 'Up to 5000 characters'],
    ['Date of Completion', 'dd/MM/yyyy or yyyy-MM-dd — required when Status is Completed'],
    [],
    ['Every row needs a Tina UUID or an AAP ID — that is what existing requests are matched on.'],
    ['A blank cell leaves the stored value unchanged; it does not clear it.'],
  ])
  ref['!cols'] = [{ wch: 20 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, ref, 'Reference')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="addresses-template.xlsx"',
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await authorize('address:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum 5MB.' }, { status: 400 })
  }
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Upload an XLSX file.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  if (rows.length === 0) {
    return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows. Maximum ${MAX_ROWS} rows per import.` },
      { status: 400 },
    )
  }

  // A renamed or missing header would otherwise surface as the same identifier
  // error on every single row, which reads as bad data rather than a bad sheet.
  const headers = Object.keys(rows[0])
  const missingColumns = COLUMNS.filter((c) => !headers.includes(c))
  if (missingColumns.length > 0) {
    return NextResponse.json(
      {
        error: `Missing column${missingColumns.length > 1 ? 's' : ''}: `
          + `${missingColumns.join(', ')}. Download the template to get the expected headers.`,
      },
      { status: 400 },
    )
  }

  const errors: RowError[] = []
  const warnings: string[] = []

  // --- Pass 1: read the sheet ------------------------------------------------
  // Matching needs every identifier in the file up front, so reading and
  // resolving are separate passes rather than one.

  const raw: RawRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed, plus the header row

    const cell = (c: (typeof COLUMNS)[number]) => String(row[c] ?? '').trim()

    const tinaUuid = cell('Tina UUID')
    const aapId = cell('AAP ID')

    if (!tinaUuid && !aapId) {
      // Fully blank trailing rows are skipped rather than reported.
      const anyValue = COLUMNS.some((c) => cell(c) !== '')
      if (anyValue) {
        errors.push({
          row: rowNum,
          message: 'A Tina UUID or an AAP ID is required — one of them identifies the request',
          field: 'Tina UUID',
        })
      }
      continue
    }

    if (tinaUuid.length > 64) {
      errors.push({ row: rowNum, message: 'Tina UUID is longer than 64 characters', field: 'Tina UUID' })
      continue
    }
    if (aapId.length > 64) {
      errors.push({ row: rowNum, message: 'AAP ID is longer than 64 characters', field: 'AAP ID' })
      continue
    }

    raw.push({
      rowNum,
      tinaUuid,
      aapId,
      reporter: cell('Reporter'),
      statusRaw: cell('Status'),
      notes: cell('Notes'),
      requestDateCell: row['Request Date'],
      completionDateCell: row['Date of Completion'],
    })
  }

  if (raw.length === 0) {
    return NextResponse.json(
      { created: 0, updated: 0, unchanged: 0, errors, warnings },
      { status: errors.length > 0 ? 422 : 400 },
    )
  }

  // --- Match against stored requests ----------------------------------------
  // Prisma's `{ in: [...] }` is case-sensitive on PostgreSQL and these are
  // opaque external identifiers, so matching goes through LOWER() in raw SQL —
  // the same reason /api/osc/bulk does.

  const identifiers = Array.from(
    new Set(raw.flatMap((r) => [r.tinaUuid, r.aapId].filter(Boolean).map((v) => v.toLowerCase()))),
  )

  const existingRecords = await prisma.$queryRaw<ExistingRecord[]>(Prisma.sql`
    SELECT id, "requestDate", reporter, "tinaUuid", "aapId", status, notes, "completionDate"
    FROM "AddressRequest"
    WHERE LOWER("tinaUuid") IN (${Prisma.join(identifiers)})
       OR LOWER("aapId") IN (${Prisma.join(identifiers)})
  `)

  const byIdentifier = new Map<string, ExistingRecord[]>()
  for (const rec of existingRecords) {
    for (const ident of [rec.tinaUuid, rec.aapId]) {
      const key = ident?.trim().toLowerCase()
      if (!key) continue
      const bucket = byIdentifier.get(key)
      if (bucket) bucket.push(rec)
      else byIdentifier.set(key, [rec])
    }
  }

  // --- Pass 2: resolve, merge and validate ----------------------------------

  const resolved = new Map<string, ResolvedRow>()
  // Which slot each identifier already claimed, so a second row carrying the
  // same identifier updates that slot instead of creating a near-duplicate.
  const slotByIdentifier = new Map<string, string>()

  for (const r of raw) {
    const idents = [r.tinaUuid, r.aapId].filter(Boolean).map((v) => v.toLowerCase())

    const matches = Array.from(
      new Map(idents.flatMap((k) => byIdentifier.get(k) ?? []).map((m) => [m.id, m])).values(),
    )

    if (matches.length > 1) {
      errors.push({
        row: r.rowNum,
        message: `These identifiers match ${matches.length} existing requests `
          + `(${matches.map((m) => addressLabel(m)).join(', ')}) — resolve the duplicates before importing`,
        field: 'Tina UUID',
      })
      continue
    }

    const existing = matches[0] ?? null

    const claimed = idents.map((k) => slotByIdentifier.get(k)).find(Boolean)
    if (claimed) {
      warnings.push(
        `Row ${r.rowNum}: an earlier row carries the same identifier — the last row wins.`,
      )
    }
    const slot = claimed ?? (existing ? `id:${existing.id}` : `new:${idents[0]}`)

    // A blank cell means "leave unchanged", so every field falls back to the
    // stored value; for a new request there is nothing to fall back to.
    const requestDate = parseSheetDate(r.requestDateCell)
    if (requestDate === 'invalid') {
      errors.push({
        row: r.rowNum,
        message: `Request Date "${String(r.requestDateCell).trim()}" is not a valid date — use dd/MM/yyyy`,
        field: 'Request Date',
      })
      continue
    }
    if (!requestDate && !existing) {
      errors.push({ row: r.rowNum, message: 'Request Date is required for a new request', field: 'Request Date' })
      continue
    }

    const completionDate = parseSheetDate(r.completionDateCell)
    if (completionDate === 'invalid') {
      errors.push({
        row: r.rowNum,
        message: `Date of Completion "${String(r.completionDateCell).trim()}" is not a valid date — use dd/MM/yyyy`,
        field: 'Date of Completion',
      })
      continue
    }

    let status: AddressRequestStatus
    if (r.statusRaw) {
      const parsedStatus = STATUS_BY_KEY.get(statusKey(r.statusRaw))
      if (!parsedStatus) {
        errors.push({
          row: r.rowNum,
          message: `Status "${r.statusRaw}" is not one of: ${STATUS_LABEL_LIST}`,
          field: 'Status',
        })
        continue
      }
      status = parsedStatus
    } else {
      status = existing?.status ?? 'NOT_STARTED'
    }

    const reporter = r.reporter || existing?.reporter || ''
    if (reporter.length < 2) {
      errors.push({
        row: r.rowNum,
        message: r.reporter
          ? 'Reporter must be at least 2 characters'
          : 'Reporter is required for a new request',
        field: 'Reporter',
      })
      continue
    }
    if (reporter.length > 128) {
      errors.push({ row: r.rowNum, message: 'Reporter is longer than 128 characters', field: 'Reporter' })
      continue
    }

    const notes = r.notes || existing?.notes || null
    if (notes && notes.length > 5000) {
      errors.push({ row: r.rowNum, message: 'Notes is longer than 5000 characters', field: 'Notes' })
      continue
    }

    // §7.4, matching the PATCH route: re-opening a completed request drops the
    // completion date unless this row supplied one.
    const mergedStatus = status
    const leavingCompleted = existing?.status === 'COMPLETED' && mergedStatus !== 'COMPLETED'

    const resolvedCompletion = resolveCompletion({
      status: mergedStatus,
      completionDate: completionDate ?? existing?.completionDate ?? null,
      clearCompletionDate: leavingCompleted && !completionDate,
    })

    const next = {
      requestDate: requestDate ?? existing!.requestDate,
      reporter,
      tinaUuid: r.tinaUuid || existing?.tinaUuid || null,
      aapId: r.aapId || existing?.aapId || null,
      status: resolvedCompletion.status,
      notes,
      completionDate: resolvedCompletion.completionDate,
    }

    const invalid = validateAddressRecord(next)
    if (invalid) {
      errors.push({ row: r.rowNum, message: invalid })
      continue
    }

    resolved.set(slot, { rowNum: r.rowNum, existingId: existing?.id ?? null, next })
    for (const k of idents) slotByIdentifier.set(k, slot)
  }

  const validRows = Array.from(resolved.values())
  if (validRows.length === 0) {
    return NextResponse.json(
      { created: 0, updated: 0, unchanged: 0, errors, warnings },
      { status: errors.length > 0 ? 422 : 400 },
    )
  }

  // --- Write ----------------------------------------------------------------
  // One transaction for the whole import: a partial import with a partial audit
  // trail is worse than a failed one.

  let created = 0
  let updated = 0

  const existingById = new Map(existingRecords.map((r) => [r.id, r]))

  await prisma.$transaction(async (tx) => {
    for (const row of validRows) {
      if (!row.existingId) {
        const record = await tx.addressRequest.create({
          data: { ...row.next, createdById: session.user.id },
        })

        await tx.auditLog.createMany({
          data: auditRows({
            entity: 'ADDRESS_REQUEST',
            entityId: record.id,
            entityLabel: addressLabel(record),
            userId: session.user.id,
            action: 'CREATE',
            changes: initialFields(record as unknown as Record<string, unknown>, ADDRESS_REQUEST_FIELDS),
          }),
        })

        created++
        continue
      }

      const prior = existingById.get(row.existingId)!
      const changes = diffFields(
        prior as unknown as Record<string, unknown>,
        row.next as unknown as Record<string, unknown>,
        ADDRESS_REQUEST_FIELDS,
      )

      if (changes.length === 0) continue

      const record = await tx.addressRequest.update({
        where: { id: row.existingId },
        data: row.next,
      })

      await tx.auditLog.createMany({
        data: auditRows({
          entity: 'ADDRESS_REQUEST',
          entityId: record.id,
          entityLabel: addressLabel(record),
          userId: session.user.id,
          action: 'UPDATE',
          changes,
        }),
      })

      updated++
    }
  }, { timeout: 120_000 })

  return NextResponse.json({
    created,
    updated,
    unchanged: validRows.length - created - updated,
    errors,
    warnings,
  })
}
