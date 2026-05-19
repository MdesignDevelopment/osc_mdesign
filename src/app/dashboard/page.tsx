import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { StatusChart } from '@/components/dashboard/status-chart'
import { PartnerChart } from '@/components/dashboard/partner-chart'
import { RecentRequests } from '@/components/dashboard/recent-requests'

async function getDashboardData() {
  const [total, byStatus, byPartner, recent, highPrio] = await Promise.all([
    prisma.oscRequest.count(),
    prisma.oscRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.oscRequest.groupBy({
      by: ['partnerId'],
      _count: { _all: true },
      orderBy: { _count: { partnerId: 'desc' } },
      take: 8,
    }),
    prisma.oscRequest.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { partner: true, createdBy: { select: { name: true } } },
    }),
    prisma.oscRequest.count({ where: { priority: 'HIGH_PRIO' } }),
  ])

  const partnerIds = byPartner.map((p) => p.partnerId)
  const partners = await prisma.partner.findMany({ where: { id: { in: partnerIds } } })
  const partnerNameMap = Object.fromEntries(partners.map((p) => [p.id, p.name]))

  return {
    total, byStatus, highPrio, recent,
    byPartner: byPartner.map((p) => ({
      name: partnerNameMap[p.partnerId] ?? 'Unknown',
      count: p._count._all,
    })),
  }
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const data = await getDashboardData()
  const statusCounts = Object.fromEntries(data.byStatus.map((s) => [s.status, s._count._all]))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#172B4D]">Dashboard</h1>
        <p className="text-sm text-[#6B778C] mt-0.5">OSC requests overview</p>
      </div>

      <StatsCards
        total={data.total}
        updated={statusCounts['OSC_UPDATED'] ?? 0}
        onHold={statusCounts['ON_HOLD'] ?? 0}
        highPrio={data.highPrio}
        emailSent={(statusCounts['EMAIL_SENT'] ?? 0) + (statusCounts['EMAIL_SENT_REMINDER'] ?? 0)}
        checkRemarks={statusCounts['CHECK_REMARKS'] ?? 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusChart data={data.byStatus.map((s) => ({ status: s.status, count: s._count._all }))} />
        <PartnerChart data={data.byPartner} />
      </div>

      <RecentRequests requests={data.recent} />
    </div>
  )
}
