import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/api-auth'
import * as XLSX from 'xlsx'
import { auditRows, diffFields, initialFields, DESIGN_SESSION_FIELDS } from '@/lib/audit'
import { resolveFlags } from '@/lib/design-sessions'
import { popZoneKeyOf, DESIGN_STAGE_ORDER, DESIGN_STAGE_LABELS } from '@/lib/utils'
import { isUnusualPopZone } from '@/lib/validations'
import { DesignStage } from '@prisma/client'

// Bulk XLSX import for design sessions.
//
// Upserts on popZoneKey rather than blind-inserting — this is exactly the
// duplicate bug already fixed once in the OSC importer (commit 4e9f4df), so it
// is designed in from the start here.
//
// Audit: a run that overwrites 300 rows is as auditable as 300 manual edits.
// New records get a CREATE row with initial values; existing records get a
// normal field-level diff. Everything is attributed to the importing user.
// See SPEC-WYER-MERKATOR.md §10.3.

const COLUMNS = [
  'POP Zone', 'Cabinet Name', 'MRO Partner', 'Stage', 'Notes', 'Actions Done',
  'Send OC Request to Partner', 'AAP on Hold', 'Ready to Post', 'Posted',
] as const

const MAX_ROWS = 1000
const MAX_BYTES = 5 * 1024 * 1024

/** Yes/No, TRUE/FALSE, 1/0 and blank (false), case-insensitive. */
function parseBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val === 1
  const s = String(val ?? '').trim().toLowerCase()
  return s === 'yes' || s === 'y' || s === 'true' || s === '1' || s === 'x'
}

/**
 * Accept the label people actually type ("On report 3") as well as the stored
 * enum name, matched loosely on case, spaces and underscores. Blank means
 * IN_SESSION; anything unrecognised is reported rather than silently defaulted,
 * because quietly filing a session under the wrong stage is worse than a
 * rejected row.
 */
function parseStage(val: unknown): DesignStage | null {
  const raw = String(val ?? '').trim()
  if (!raw) return 'IN_SESSION'
  const norm = raw.toUpperCase().replace(/[\s-]+/g, '_')
  return (DESIGN_STAGE_ORDER as readonly string[]).includes(norm)
    ? (norm as DesignStage)
    : null
}

interface RowError {
  row: number
  message: string
  field?: string
}

interface ParsedRow {
  popZone: string
  popZoneKey: string
  cabinetName: string | null
  mroPartner: string | null
  stage: DesignStage
  notes: string | null
  actionsDone: string | null
  sendOcRequestToPartner: boolean
  aapOnHold: boolean
  readyToPost: boolean
  posted: boolean
}

// GET — blank template, mirroring the OSC importer's affordance.
export async function GET() {
  const auth = await authorize('design:write')
  if (!auth.ok) return auth.response

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    [...COLUMNS],
    [
      'MRO_CITY_01_POP_001', 'H70CA03HA06', 'ZTE',
      'Example note', 'Example action', 'No', 'No', 'No', 'No',
    ],
  ])

  ws['!cols'] = [
    { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 40 },
    { wch: 40 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Design Sessions')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="design-sessions-template.xlsx"',
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await authorize('design:write')
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

  const errors: RowError[] = []
  const warnings: string[] = []
  const parsed = new Map<string, ParsedRow>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed, plus the header row

    const popZoneRaw = String(row['POP Zone'] ?? '').trim()
    if (!popZoneRaw) {
      // Fully blank trailing rows are skipped rather than reported.
      const anyValue = COLUMNS.some((c) => String(row[c] ?? '').trim() !== '')
      if (anyValue) errors.push({ row: rowNum, message: 'POP Zone is required', field: 'POP Zone' })
      continue
    }

    if (!/^[A-Za-z0-9_-]+$/.test(popZoneRaw)) {
      errors.push({
        row: rowNum,
        message: `POP Zone "${popZoneRaw}" contains spaces or punctuation`,
        field: 'POP Zone',
      })
      continue
    }

    if (isUnusualPopZone(popZoneRaw)) {
      warnings.push(`Row ${rowNum}: "${popZoneRaw}" does not match the usual MRO_<CITY>_<NN>_POP_<NNN> format.`)
    }

    const stage = parseStage(row['Stage'])
    if (stage === null) {
      errors.push({
        row: rowNum,
        message: `Stage "${String(row['Stage']).trim()}" is not one of: `
          + DESIGN_STAGE_ORDER.map((s) => DESIGN_STAGE_LABELS[s]).join(', '),
        field: 'Stage',
      })
      continue
    }

    const flags = resolveFlags(
      { sendOcRequestToPartner: false, aapOnHold: false, readyToPost: false, posted: false },
      {
        sendOcRequestToPartner: parseBool(row['Send OC Request to Partner']),
        aapOnHold: parseBool(row['AAP on Hold']),
        readyToPost: parseBool(row['Ready to Post']),
        posted: parseBool(row['Posted']),
      },
    )

    const key = popZoneKeyOf(popZoneRaw)

    // Within-file duplicates: last occurrence wins, and we say so rather than
    // silently dropping earlier rows.
    if (parsed.has(key)) {
      warnings.push(`Row ${rowNum}: duplicate POP Zone "${key}" in this file — the last row wins.`)
    }

    parsed.set(key, {
      popZone: popZoneRaw,
      popZoneKey: key,
      cabinetName: String(row['Cabinet Name'] ?? '').trim() || null,
      mroPartner: String(row['MRO Partner'] ?? '').trim() || null,
      stage,
      notes: String(row['Notes'] ?? '').trim() || null,
      actionsDone: String(row['Actions Done'] ?? '').trim() || null,
      ...flags.flags,
    })
  }

  const validRows = Array.from(parsed.values())
  if (validRows.length === 0) {
    return NextResponse.json(
      { created: 0, updated: 0, errors, warnings },
      { status: errors.length > 0 ? 422 : 400 },
    )
  }

  const existing = await prisma.designSession.findMany({
    where: { popZoneKey: { in: validRows.map((r) => r.popZoneKey) } },
  })
  const existingByKey = new Map(existing.map((e) => [e.popZoneKey, e]))

  let created = 0
  let updated = 0

  // One transaction for the whole import: a partial import with a partial audit
  // trail is worse than a failed one.
  await prisma.$transaction(async (tx) => {
    for (const row of validRows) {
      const prior = existingByKey.get(row.popZoneKey)

      if (!prior) {
        const record = await tx.designSession.create({
          data: { ...row, createdById: session.user.id },
        })

        await tx.scriptExecution.updateMany({
          where: { popZoneKey: row.popZoneKey, designSessionId: null },
          data: { designSessionId: record.id },
        })

        await tx.auditLog.createMany({
          data: auditRows({
            entity: 'DESIGN_SESSION',
            entityId: record.id,
            entityLabel: record.popZone,
            userId: session.user.id,
            action: 'CREATE',
            changes: initialFields(record as unknown as Record<string, unknown>, DESIGN_SESSION_FIELDS),
          }),
        })

        created++
        continue
      }

      const changes = diffFields(
        prior as unknown as Record<string, unknown>,
        row as unknown as Record<string, unknown>,
        DESIGN_SESSION_FIELDS,
      )

      if (changes.length === 0) continue

      const record = await tx.designSession.update({
        where: { id: prior.id },
        data: {
          popZone: row.popZone,
          cabinetName: row.cabinetName,
          mroPartner: row.mroPartner,
          stage: row.stage,
          notes: row.notes,
          actionsDone: row.actionsDone,
          sendOcRequestToPartner: row.sendOcRequestToPartner,
          aapOnHold: row.aapOnHold,
          readyToPost: row.readyToPost,
          posted: row.posted,
        },
      })

      await tx.auditLog.createMany({
        data: auditRows({
          entity: 'DESIGN_SESSION',
          entityId: record.id,
          entityLabel: record.popZone,
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
