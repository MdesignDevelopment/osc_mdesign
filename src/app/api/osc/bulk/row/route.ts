import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/api-auth'
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
  'medium priority': 'MEDIUM_PRIO',
  'medium': 'MEDIUM_PRIO',
  'low priority': 'LOW_PRIO',
  'low': 'LOW_PRIO',
  'not defined': 'NOT_DEFINED',
  '': 'NOT_DEFINED',
}

function parseDate(val: unknown): Date | null {
  if (!val) return null
  const str = String(val).trim()
  if (!str) return null
  const d1 = parse(str, 'dd/MM/yyyy', new Date())
  if (isValid(d1)) return d1
  const d2 = parse(str, 'yyyy-MM-dd', new Date())
  if (isValid(d2)) return d2
  return null
}

// POST — upsert a single corrected row from the inline fix form
export async function POST(req: NextRequest) {
  const auth = await authorize('osc:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const body = await req.json()

  const partnerName = String(body.partner ?? '').trim()
  const popzone = String(body.popzone ?? '').trim()
  const statusRaw = String(body.status ?? '').trim()
  const priorityRaw = String(body.priority ?? '').trim()
  const remarkRaw = String(body.remark ?? '').trim()

  if (!partnerName) {
    return NextResponse.json({ error: 'Partner is required', field: 'partner' }, { status: 422 })
  }
  if (!popzone) {
    return NextResponse.json({ error: 'Pop Zone is required', field: 'popzone' }, { status: 422 })
  }

  const partner = await prisma.partner.findFirst({
    where: { name: { equals: partnerName, mode: 'insensitive' } },
  })
  if (!partner) {
    return NextResponse.json({ error: `Unknown partner: "${partnerName}"`, field: 'partner' }, { status: 422 })
  }

  const status = STATUS_MAP[statusRaw.toLowerCase()]
  if (!status) {
    return NextResponse.json({
      error: `Invalid status: "${statusRaw}" — use: On Hold, OSC Updated, Email Sent, Email Sent + Reminder, Check Remarks`,
      field: 'status',
    }, { status: 422 })
  }

  const priority = PRIORITY_MAP[priorityRaw.toLowerCase()] ?? 'NOT_DEFINED'

  const data = {
    partnerId: partner.id,
    status,
    priority,
    remark: remarkRaw || null,
    receivedDate: parseDate(body.receivedDate),
    oscRequestDate: parseDate(body.oscRequestDate),
    mailSentDate: parseDate(body.mailSentDate),
    updatedDate: parseDate(body.updatedDate),
  }

  const existing = await prisma.oscRequest.findFirst({
    where: { popzone: { equals: popzone, mode: 'insensitive' } },
  })

  if (existing) {
    await prisma.oscRequest.update({ where: { id: existing.id }, data })
    return NextResponse.json({ created: 0, updated: 1 })
  }

  await prisma.oscRequest.create({
    data: { ...data, popzone, createdById: session.user.id },
  })
  return NextResponse.json({ created: 1, updated: 0 }, { status: 201 })
}
