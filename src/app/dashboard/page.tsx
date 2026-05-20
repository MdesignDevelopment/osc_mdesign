import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { differenceInDays, subDays, format } from 'date-fns'
import { OscStatus } from '@prisma/client'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { StatusChart } from '@/components/dashboard/status-chart'
import { PartnerChart } from '@/components/dashboard/partner-chart'
import { MailTrendChart } from '@/components/dashboard/mail-trend-chart'
import { RecentRequests } from '@/components/dashboard/recent-requests'
import { RecentFilters } from '@/components/dashboard/recent-filters'

interface DashboardPageProps {
  searchParams: {
    search?: string
    partner?: string
    timeframe?: string
  }
}

function getTimeframeStart(timeframe?: string): Date | null {
  if (!timeframe) return null
  const now = new Date()
  if (timeframe === 'today') return subDays(now, 1)
  if (timeframe === 'week') return subDays(now, 7)
  if (timeframe === 'month') return subDays(now, 30)
  return null
}

async function getDashboardData() {
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

  const partnerIds = byPartner.map((p: { partnerId: string; _count: { _all: number } }) => p.partnerId)
  const partnerRows = await prisma.partner.findMany({ where: { id: { in: partnerIds } } })
  const partnerNameMap = Object.fromEntries(
    partnerRows.map((p: { id: string; name: string }) => [p.id, p.name] as [string, string])
  )

  type TimingRow = { receivedDate: Date | null; oscRequestDate: Date | null; mailSentDate: Date | null; updatedDate: Date | null }
  const oscDiffs = (timingData as TimingRow[])
    .filter((r) => r.oscRequestDate && r.updatedDate)
    .map((r) => Math.abs(differenceInDays(r.updatedDate!, r.oscRequestDate!)))
  const avgOscDays =
    oscDiffs.length > 0
      ? Math.round(oscDiffs.reduce((a: number, b: number) => a + b, 0) / oscDiffs.length)
      : 0

  const mailDiffs = (timingData as TimingRow[])
    .filter((r) => r.mailSentDate)
    .map((r) => Math.abs(differenceInDays(r.mailSentDate!, r.receivedDate!)))
  const avgMailDays =
    mailDiffs.length > 0
      ? Math.round(mailDiffs.reduce((a: number, b: number) => a + b, 0) / mailDiffs.length)
      : 0

  const partnerRequests = await prisma.oscRequest.findMany({
    where: { partnerId: { in: partnerIds } },
    select: { partnerId: true, receivedDate: true, status: true },
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
  }))

  const mailTrendRaw = await prisma.oscRequest.findMany({
    where: { OR: [{ receivedDate: { not: null } }, { mailSentDate: { not: null } }] },
    select: { receivedDate: true, mailSentDate: true, partner: { select: { name: true } } },
  })

  const mailTrendData = mailTrendRaw.map(
    (r: { receivedDate: Date | null; mailSentDate: Date | null; partner: { name: string } }) => ({
      receivedDate: r.receivedDate?.toISOString() ?? null,
      mailSentDate: r.mailSentDate?.toISOString() ?? null,
      partnerName: r.partner.name,
    })
  )

  const mailTrendPartners = Array.from(
    new Set(mailTrendData.map((d: { partnerName: string }) => d.partnerName))
  ).sort()

  return {
    total,
    byStatus,
    highPrio,
    weeklyCount,
    avgOscDays,
    avgMailDays,
    byPartnerStacked,
    mailTrendData,
    mailTrendPartners,
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const [data, allPartners] = await Promise.all([
    getDashboardData(),
    prisma.partner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const statusCounts = Object.fromEntries(
    data.byStatus.map((s: { status: string; _count: { _all: number } }) => [s.status, s._count._all])
  )

  const timeframeStart = getTimeframeStart(searchParams.timeframe)
  const recent = await prisma.oscRequest.findMany({
    take: 20,
    where: {
      ...(searchParams.search && {
        OR: [
          { popzone: { contains: searchParams.search, mode: 'insensitive' as const } },
          { partner: { name: { contains: searchParams.search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(searchParams.partner && { partnerId: searchParams.partner }),
      ...(timeframeStart && { receivedDate: { gte: timeframeStart } }),
    },
    orderBy: { createdAt: 'desc' },
    include: { partner: true, createdBy: { select: { name: true } } },
  })

  const today = format(new Date(), 'EEEE, MMMM d')
  const checkRemarks = statusCounts['CHECK_REMARKS'] ?? 0
  const attentionCount = data.highPrio + checkRemarks

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Dashboard</h1>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">{today}</p>
        </div>
      </div>

      {/* Attention banner */}
      {attentionCount > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                {attentionCount} request{attentionCount !== 1 ? 's' : ''} need attention
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                {[
                  data.highPrio > 0 && `${data.highPrio} high priority`,
                  checkRemarks > 0 && `${checkRemarks} check remarks`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <Link
            href="/osc"
            className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 flex-shrink-0 whitespace-nowrap transition-colors"
          >
            Review all →
          </Link>
        </div>
      )}

      {/* KPIs */}
      <StatsCards
        total={data.total}
        updated={statusCounts['OSC_UPDATED'] ?? 0}
        onHold={statusCounts['ON_HOLD'] ?? 0}
        highPrio={data.highPrio}
        emailSent={(statusCounts['EMAIL_SENT'] ?? 0) + (statusCounts['EMAIL_SENT_REMINDER'] ?? 0)}
        checkRemarks={checkRemarks}
        weeklyCount={data.weeklyCount}
        avgOscDays={data.avgOscDays}
        avgMailDays={data.avgMailDays}
      />

      {/* Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
        <div className="lg:col-span-2 min-h-[420px]">
          <StatusChart
            data={data.byStatus.map((s: { status: string; _count: { _all: number } }) => ({ status: s.status as OscStatus, count: s._count._all }))}
            total={data.total}
          />
        </div>
        <div className="lg:col-span-3 min-h-[420px]">
          <PartnerChart data={data.byPartnerStacked} />
        </div>
      </div>

      {/* Mail activity */}
      <MailTrendChart data={data.mailTrendData} partners={data.mailTrendPartners} />

      {/* Recent requests */}
      <div className="space-y-3">
        <RecentFilters
          partners={allPartners}
          currentSearch={searchParams.search ?? ''}
          currentPartner={searchParams.partner ?? ''}
          currentTimeframe={searchParams.timeframe ?? ''}
        />
        <RecentRequests requests={recent} />
      </div>
    </div>
  )
}
