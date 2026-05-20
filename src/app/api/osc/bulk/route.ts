import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { parse, isValid } from 'date-fns'
import { OscStatus, Priority } from '@prisma/client'

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
  'low priority': 'LOW_PRIO',
  'low': 'LOW_PRIO',
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

// GET — download a blank template
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Partner', 'Pop Zone', 'Status', 'Priority', 'Remark', 'Received Date', 'OSC Request Date', 'Mail Sent Date', 'Updated Date'],
    ['Partner Name', 'MRO_CITY_01_POP_001', 'On Hold', 'High Priority', 'Example remark', '01/01/2025', '', '', ''],
  ])

  ws['!cols'] = [
    { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 16 },
    { wch: 40 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
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

// POST — upload and import
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'EXTERN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  if (rows.length === 0) return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })

  const partners = await prisma.partner.findMany()
  const partnerMap = new Map(partners.map((p) => [p.name.toLowerCase().trim(), p.id]))

  type CreateData = Parameters<typeof prisma.oscRequest.create>[0]['data']
  const errors: Array<{ row: number; message: string }> = []
  const toCreate: CreateData[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    const partnerName = String(row['Partner'] ?? '').trim()
    const popzone = String(row['Pop Zone'] ?? '').trim()
    const statusRaw = String(row['Status'] ?? '').trim().toLowerCase()
    const priorityRaw = String(row['Priority'] ?? '').trim().toLowerCase()

    if (!partnerName && !popzone) continue

    const partnerId = partnerMap.get(partnerName.toLowerCase())
    if (!partnerId) {
      errors.push({ row: rowNum, message: `Unknown partner: "${partnerName}"` })
      continue
    }

    if (!popzone) {
      errors.push({ row: rowNum, message: 'Pop Zone is required' })
      continue
    }

    const status = STATUS_MAP[statusRaw]
    if (!status) {
      errors.push({ row: rowNum, message: `Invalid status: "${row['Status']}" — use: On Hold, OSC Updated, Email Sent, Email Sent + Reminder, Check Remarks` })
      continue
    }

    const priority = priorityRaw ? (PRIORITY_MAP[priorityRaw] ?? null) : null

    toCreate.push({
      partnerId,
      popzone,
      status,
      priority,
      remark: String(row['Remark'] ?? '').trim() || null,
      receivedDate: parseDate(row['Received Date']),
      oscRequestDate: parseDate(row['OSC Request Date']),
      mailSentDate: parseDate(row['Mail Sent Date']),
      updatedDate: parseDate(row['Updated Date']),
      createdById: session.user.id,
    })
  }

  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0, errors }, { status: errors.length > 0 ? 422 : 400 })
  }

  const created = await prisma.$transaction(
    toCreate.map((data) => prisma.oscRequest.create({ data }))
  )

  return NextResponse.json({ created: created.length, errors })
}
