import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { subDays, differenceInDays } from 'date-fns'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const oneWeekAgo = subDays(new Date(), 7)

  const [total, byStatus, byPartner, highPrio, weeklyCount, timingData] = await Promise.all([
    prisma.oscRequest.count(),
    prisma.oscRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.oscRequest.groupBy({
      by: ['partnerId'],
      _count: { _all: true },
      orderBy: { _count: { partnerId: 'desc' } },
      take: 10,
    }),
    prisma.oscRequest.count({ where: { priority: 'HIGH_PRIO' } }),
    prisma.oscRequest.count({ where: { receivedDate: { gte: oneWeekAgo } } }),
    prisma.oscRequest.findMany({
      where: { receivedDate: { not: null } },
      select: { receivedDate: true, oscRequestDate: true, mailSentDate: true, updatedDate: true },
      take: 500,
    }),
  ])

  const partnerIds = byPartner.map((p: { partnerId: string }) => p.partnerId)
  const partnerRows = await prisma.partner.findMany({ where: { id: { in: partnerIds } } })
  const partnerNameMap = Object.fromEntries(
    partnerRows.map((p: { id: string; name: string }) => [p.id, p.name])
  )

  type TimingRow = {
    receivedDate: Date | null
    oscRequestDate: Date | null
    mailSentDate: Date | null
    updatedDate: Date | null
  }

  const oscDiffs = (timingData as TimingRow[])
    .filter((r) => r.oscRequestDate && r.updatedDate)
    .map((r) => Math.abs(differenceInDays(r.updatedDate!, r.oscRequestDate!)))
  const avgOscDays =
    oscDiffs.length > 0
      ? Math.round(oscDiffs.reduce((a: number, b: number) => a + b, 0) / oscDiffs.length)
      : 0

  const mailDiffs = (timingData as TimingRow[])
    .filter((r) => r.mailSentDate && r.receivedDate)
    .map((r) => Math.abs(differenceInDays(r.mailSentDate!, r.receivedDate!)))
  const avgMailDays =
    mailDiffs.length > 0
      ? Math.round(mailDiffs.reduce((a: number, b: number) => a + b, 0) / mailDiffs.length)
      : 0

  const partnerRequests = await prisma.oscRequest.findMany({
    where: { partnerId: { in: partnerIds } },
    select: { partnerId: true, status: true, receivedDate: true },
  })

  const buckets: Record<string, { oscRequest: number; received: number; updated: number }> = {}
  for (const req of partnerRequests) {
    if (!buckets[req.partnerId]) buckets[req.partnerId] = { oscRequest: 0, received: 0, updated: 0 }
    if (req.status === 'OSC_UPDATED') {
      buckets[req.partnerId].updated++
    } else if (req.receivedDate !== null) {
      buckets[req.partnerId].received++
    } else {
      buckets[req.partnerId].oscRequest++
    }
  }

  const byPartnerStacked = byPartner.map((p: { partnerId: string; _count: { _all: number } }) => ({
    name: partnerNameMap[p.partnerId] ?? 'Unknown',
    oscRequest: buckets[p.partnerId]?.oscRequest ?? 0,
    received: buckets[p.partnerId]?.received ?? 0,
    updated: buckets[p.partnerId]?.updated ?? 0,
    total: p._count._all,
  }))

  const checkRemarks =
    (byStatus as { status: string; _count: { _all: number } }[]).find(
      (s) => s.status === 'CHECK_REMARKS'
    )?._count._all ?? 0

  const statusMap = Object.fromEntries(
    (byStatus as { status: string; _count: { _all: number } }[]).map((s) => [s.status, s._count._all])
  )
  const ALL_STATUSES = ['OSC_UPDATED', 'EMAIL_SENT', 'EMAIL_SENT_REMINDER', 'ON_HOLD', 'CHECK_REMARKS']
  const allByStatus = ALL_STATUSES.map((status) => ({ status, count: statusMap[status] ?? 0 }))

  return NextResponse.json({
    total,
    byStatus: allByStatus,
    highPrio,
    checkRemarks,
    weeklyCount,
    avgOscDays,
    avgMailDays,
    byPartnerStacked,
    generatedAt: new Date().toISOString(),
  })
}
