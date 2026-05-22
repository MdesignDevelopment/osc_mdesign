import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { differenceInDays, format, subDays } from 'date-fns'

const STATUS_LABELS: Record<string, string> = {
  OSC_UPDATED: 'OSC Updated',
  EMAIL_SENT: 'Email Sent',
  EMAIL_SENT_REMINDER: 'Email + Reminder',
  ON_HOLD: 'On Hold',
  CHECK_REMARKS: 'Check Remarks',
}

const PRIORITY_LABELS: Record<string, string> = {
  HIGH_PRIO: 'High Priority',
  MEDIUM_PRIO: 'Medium Priority',
  LOW_PRIO: 'Low Priority',
  NOT_DEFINED: 'Not defined',
}

function fmt(date: Date | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd/MM/yyyy')
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const oneWeekAgo = subDays(new Date(), 7)

  const [requests, byStatus, byPartnerRaw, weeklyCount] = await Promise.all([
    prisma.oscRequest.findMany({
      orderBy: [
        { priority: { sort: 'asc', nulls: 'last' } },
        { receivedDate: { sort: 'desc', nulls: 'last' } },
      ],
      include: {
        partner: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.oscRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.oscRequest.groupBy({
      by: ['partnerId'],
      _count: { _all: true },
      orderBy: { _count: { partnerId: 'desc' } },
    }),
    prisma.oscRequest.count({ where: { receivedDate: { gte: oneWeekAgo } } }),
  ])

  const partnerIds = byPartnerRaw.map((p) => p.partnerId)
  const partnerRows = await prisma.partner.findMany({ where: { id: { in: partnerIds } } })
  const partnerMap = Object.fromEntries(partnerRows.map((p) => [p.id, p.name]))

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]))
  const total = requests.length
  const highPrio = requests.filter((r) => r.priority === 'HIGH_PRIO').length

  const oscDiffs = requests
    .filter((r) => r.oscRequestDate && r.updatedDate)
    .map((r) => Math.abs(differenceInDays(r.updatedDate!, r.oscRequestDate!)))
  const avgOscDays =
    oscDiffs.length > 0 ? Math.round(oscDiffs.reduce((a, b) => a + b, 0) / oscDiffs.length) : 0

  const mailDiffs = requests
    .filter((r) => r.mailSentDate && r.receivedDate)
    .map((r) => Math.abs(differenceInDays(r.mailSentDate!, r.receivedDate!)))
  const avgMailDays =
    mailDiffs.length > 0 ? Math.round(mailDiffs.reduce((a, b) => a + b, 0) / mailDiffs.length) : 0

  const statusBreakdown = [...byStatus]
    .sort((a, b) => b._count._all - a._count._all)
    .map((s) => ({
      label: STATUS_LABELS[s.status] ?? s.status,
      count: s._count._all,
      pct: total > 0 ? `${((s._count._all / total) * 100).toFixed(1)}%` : '0%',
    }))

  const partnerBreakdown = byPartnerRaw.map((p) => ({
    name: partnerMap[p.partnerId] ?? 'Unknown',
    count: p._count._all,
    pct: total > 0 ? `${((p._count._all / total) * 100).toFixed(1)}%` : '0%',
  }))

  const formattedRequests = requests.map((r) => ({
    popzone: r.popzone,
    partner: r.partner.name,
    status: STATUS_LABELS[r.status] ?? r.status,
    priority: r.priority ? (PRIORITY_LABELS[r.priority] ?? r.priority) : '—',
    remark: r.remark ? (r.remark.length > 70 ? r.remark.slice(0, 70) + '…' : r.remark) : '—',
    receivedDate: fmt(r.receivedDate),
    oscRequestDate: fmt(r.oscRequestDate),
    mailSentDate: fmt(r.mailSentDate),
    updatedDate: fmt(r.updatedDate),
    createdBy: r.createdBy.name,
    isHighPrio: r.priority === 'HIGH_PRIO',
  }))

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    stats: {
      total,
      updated: statusMap['OSC_UPDATED'] ?? 0,
      highPrio,
      checkRemarks: statusMap['CHECK_REMARKS'] ?? 0,
      weeklyCount,
      avgOscDays,
      avgMailDays,
    },
    statusBreakdown,
    partnerBreakdown,
    requests: formattedRequests,
  })
}
