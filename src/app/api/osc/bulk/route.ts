import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/api-auth'
import * as XLSX from 'xlsx'
import { parse, isValid } from 'date-fns'
import { OscStatus, Priority, Prisma } from '@prisma/client'

const STATUS_MAP: Record<string, OscStatus> = {
  'osc updated': 'OSC_UPDATED',
  'email sent': 'EMAIL_SENT',
  'email sent + reminder': 'EMAIL_SENT_REMINDER',
  'email + reminder': 'EMAIL_SENT_REMINDER',
  'on hold': 'ON_HOLD',
  'check remarks': 'CHECK_REMARKS',
}

const PRIORITY_MAP: Record<string, Priority> = {
  'high priority': 'HIGH_PRIO',
  'high': 'HIGH_PRIO',
  'medium priority': 'MEDIUM_PRIO',
  'medium': 'MEDIUM_PRIO',
  'low priority': 'LOW_PRIO',
  'low': 'LOW_PRIO',
  'not defined': 'NOT_DEFINED',
  '': 'NOT_DEFINED',
}

function parseDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date && isValid(val)) return val
  const str = String(val).trim()
  if (!str) return null
  const d1 = parse(str, 'dd/MM/yyyy', new Date())
  if (isValid(d1)) return d1
  const d2 = parse(str, 'yyyy-MM-dd', new Date())
  if (isValid(d2)) return d2
  return null
}

interface RowData {
  partner: string
  popzone: string
  status: string
  priority: string
  remark: string
  oscRequestDate: string
  mailSentDate: string
  receivedDate: string
  updatedDate: string
}

interface RowError {
  row: number
  message: string
  field?: string
  rowData?: RowData
}

interface ProcessedRow {
  partnerId: string
  popzone: string
  status: OscStatus
  priority: Priority
  remark: string | null
  receivedDate: Date | null
  oscRequestDate: Date | null
  mailSentDate: Date | null
  updatedDate: Date | null
  rowData: RowData
}

// GET — download a blank template
export async function GET() {
  const auth = await authorize('osc:write')
  if (!auth.ok) return auth.response

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Partner', 'Pop Zone', 'Status', 'Priority', 'Remark', 'OSC Request Date', 'Mail Sent Date', 'Received Date', 'Updated Date'],
    ['Partner Name', 'MRO_CITY_01_POP_001', 'On Hold', 'High Priority', 'Example remark', '01/01/2025', '', '', ''],
  ])

  ws['!cols'] = [
    { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 16 },
    { wch: 40 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'OSC Bulk Import')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="osc-bulk-template.xlsx"',
    },
  })
}

// POST — upload and upsert
export async function POST(req: NextRequest) {
  const auth = await authorize('osc:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024) {
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

  if (rows.length === 0) return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })
  if (rows.length > 1000) return NextResponse.json({ error: 'Too many rows. Maximum 1000 rows per import.' }, { status: 400 })

  const partners = await prisma.partner.findMany()
  const partnerMap = new Map(partners.map((p) => [p.name.toLowerCase().trim(), p.id]))

  const errors: RowError[] = []
  const valid: ProcessedRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    const partnerName = String(row['Partner'] ?? '').trim()
    const popzone = String(row['Pop Zone'] ?? '').trim()
    const statusRaw = String(row['Status'] ?? '').trim()
    const priorityRaw = String(row['Priority'] ?? '').trim()
    const remarkRaw = String(row['Remark'] ?? '').trim()
    const oscRequestDateRaw = String(row['OSC Request Date'] ?? '').trim()
    const mailSentDateRaw = String(row['Mail Sent Date'] ?? '').trim()
    const receivedDateRaw = String(row['Received Date'] ?? '').trim()
    const updatedDateRaw = String(row['Updated Date'] ?? '').trim()

    if (!partnerName && !popzone) continue

    const rowData: RowData = {
      partner: partnerName,
      popzone,
      status: statusRaw,
      priority: priorityRaw,
      remark: remarkRaw,
      oscRequestDate: oscRequestDateRaw,
      mailSentDate: mailSentDateRaw,
      receivedDate: receivedDateRaw,
      updatedDate: updatedDateRaw,
    }

    const partnerId = partnerMap.get(partnerName.toLowerCase())
    if (!partnerId) {
      errors.push({ row: rowNum, message: `Unknown partner: "${partnerName}"`, field: 'partner', rowData })
      continue
    }

    if (!popzone) {
      errors.push({ row: rowNum, message: 'Pop Zone is required', field: 'popzone', rowData })
      continue
    }

    const status = STATUS_MAP[statusRaw.toLowerCase()]
    if (!status) {
      errors.push({
        row: rowNum,
        message: `Invalid status: "${statusRaw}" — use: On Hold, OSC Updated, Email Sent, Email Sent + Reminder, Check Remarks`,
        field: 'status',
        rowData,
      })
      continue
    }

    const priority = PRIORITY_MAP[priorityRaw.toLowerCase()] ?? 'NOT_DEFINED'

    valid.push({
      partnerId,
      popzone,
      status,
      priority,
      remark: remarkRaw || null,
      receivedDate: parseDate(row['Received Date']),
      oscRequestDate: parseDate(row['OSC Request Date']),
      mailSentDate: parseDate(row['Mail Sent Date']),
      updatedDate: parseDate(row['Updated Date']),
      rowData,
    })
  }

  if (valid.length === 0) {
    return NextResponse.json({ created: 0, updated: 0, errors }, { status: errors.length > 0 ? 422 : 400 })
  }

  // Deduplicate by popzone case-insensitively — last occurrence wins
  const rowMap = new Map<string, ProcessedRow>()
  for (const r of valid) {
    rowMap.set(r.popzone.toLowerCase(), r)
  }
  const deduped = Array.from(rowMap.values())

  // Case-insensitive lookup with full field data for history diffing.
  // Prisma's { in: [...] } is case-sensitive in PostgreSQL, so we use raw LOWER().
  const lowerNames = deduped.map((r) => r.popzone.toLowerCase())

  type ExistingRecord = {
    id: string
    popzone: string
    status: string
    priority: string | null
    remark: string | null
    receivedDate: Date | null
    oscRequestDate: Date | null
    mailSentDate: Date | null
    updatedDate: Date | null
    partnerId: string
  }

  const existingRecords = await prisma.$queryRaw<ExistingRecord[]>(
    Prisma.sql`
      SELECT id, popzone, status, priority, remark,
             "receivedDate", "oscRequestDate", "mailSentDate", "updatedDate", "partnerId"
      FROM "OscRequest"
      WHERE LOWER(popzone) IN (${Prisma.join(lowerNames)})
    `
  )
  const existingByLower = new Map(existingRecords.map((r) => [r.popzone.toLowerCase(), r]))

  const toCreate = deduped.filter((r) => !existingByLower.has(r.popzone.toLowerCase()))
  const toUpdate = deduped.filter((r) => existingByLower.has(r.popzone.toLowerCase()))

  // Build history entries for every changed field on each updated row
  type HistoryEntry = { oscRequestId: string; userId: string; fieldChanged: string; oldValue: string | null; newValue: string | null }
  const historyEntries: HistoryEntry[] = []

  for (const r of toUpdate) {
    const ex = existingByLower.get(r.popzone.toLowerCase())!
    const scalarFields: Array<[string, string | null, string | null]> = [
      ['status', ex.status, r.status],
      ['priority', ex.priority ?? null, r.priority],
      ['remark', ex.remark, r.remark],
      ['partnerId', ex.partnerId, r.partnerId],
    ]
    for (const [field, oldVal, newVal] of scalarFields) {
      if (oldVal !== newVal) {
        historyEntries.push({ oscRequestId: ex.id, userId: session.user.id, fieldChanged: field, oldValue: oldVal || null, newValue: newVal || null })
      }
    }
    const dateFields: Array<[string, Date | null, Date | null]> = [
      ['receivedDate', ex.receivedDate, r.receivedDate],
      ['oscRequestDate', ex.oscRequestDate, r.oscRequestDate],
      ['mailSentDate', ex.mailSentDate, r.mailSentDate],
      ['updatedDate', ex.updatedDate, r.updatedDate],
    ]
    for (const [field, oldDate, newDate] of dateFields) {
      const oldStr = oldDate ? new Date(oldDate).toISOString().split('T')[0] : null
      const newStr = newDate ? newDate.toISOString().split('T')[0] : null
      if (oldStr !== newStr) {
        historyEntries.push({ oscRequestId: ex.id, userId: session.user.id, fieldChanged: field, oldValue: oldStr, newValue: newStr })
      }
    }
  }

  await prisma.$transaction([
    prisma.oscRequest.createMany({
      data: toCreate.map((r) => ({
        partnerId: r.partnerId,
        popzone: r.popzone,
        status: r.status,
        priority: r.priority,
        remark: r.remark,
        receivedDate: r.receivedDate,
        oscRequestDate: r.oscRequestDate,
        mailSentDate: r.mailSentDate,
        updatedDate: r.updatedDate,
        createdById: session.user.id,
      })),
    }),
    ...toUpdate.map((r) =>
      prisma.oscRequest.update({
        where: { id: existingByLower.get(r.popzone.toLowerCase())!.id },
        data: {
          partnerId: r.partnerId,
          status: r.status,
          priority: r.priority,
          remark: r.remark,
          receivedDate: r.receivedDate,
          oscRequestDate: r.oscRequestDate,
          mailSentDate: r.mailSentDate,
          updatedDate: r.updatedDate,
        },
      })
    ),
    ...historyEntries.map((h) => prisma.oscHistory.create({ data: h })),
  ])

  return NextResponse.json({ created: toCreate.length, updated: toUpdate.length, errors })
}
