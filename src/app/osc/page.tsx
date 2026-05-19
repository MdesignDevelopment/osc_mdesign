import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { OscTable } from '@/components/osc/osc-table'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { OscStatus, Priority } from '@prisma/client'

interface PageProps {
  searchParams: {
    search?: string
    status?: string
    partner?: string
    priority?: string
    page?: string
    sort?: string
    dir?: string
  }
}

const PAGE_SIZE = 25

type SortDir = 'asc' | 'desc'

function buildOrderBy(sort?: string, dir?: string) {
  const d: SortDir = dir === 'desc' ? 'desc' : 'asc'

  switch (sort) {
    case 'popzone':
      return [{ popzone: d }]
    case 'partner':
      return [{ partner: { name: d } }]
    case 'status':
      return [{ status: d }]
    case 'priority':
      return [{ priority: { sort: d, nulls: 'last' as const } }]
    case 'receivedDate':
      return [{ receivedDate: { sort: d, nulls: 'last' as const } }]
    case 'oscRequestDate':
      return [{ oscRequestDate: { sort: d, nulls: 'last' as const } }]
    case 'mailSentDate':
      return [{ mailSentDate: { sort: d, nulls: 'last' as const } }]
    case 'remark':
      return [{ remark: { sort: d, nulls: 'last' as const } }]
    default:
      return [
        { priority: { sort: 'asc' as const, nulls: 'last' as const } },
        { receivedDate: { sort: 'desc' as const, nulls: 'last' as const } },
        { createdAt: 'desc' as const },
      ]
  }
}

export default async function OscListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    ...(searchParams.search && {
      OR: [
        { popzone: { contains: searchParams.search, mode: 'insensitive' as const } },
        { partner: { name: { contains: searchParams.search, mode: 'insensitive' as const } } },
        { remark: { contains: searchParams.search, mode: 'insensitive' as const } },
      ],
    }),
    ...(searchParams.status && { status: searchParams.status as OscStatus }),
    ...(searchParams.partner && { partnerId: searchParams.partner }),
    ...(searchParams.priority && { priority: searchParams.priority as Priority }),
  }

  const [requests, total, partners] = await Promise.all([
    prisma.oscRequest.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: buildOrderBy(searchParams.sort, searchParams.dir),
      include: { partner: true, createdBy: { select: { name: true } } },
    }),
    prisma.oscRequest.count({ where }),
    prisma.partner.findMany({ orderBy: { name: 'asc' } }),
  ])

  const canCreate = session.user.role === 'ADMIN' || session.user.role === 'SUPPORT_ENGINEER'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#172B4D]">OSC Requests</h1>
          <p className="text-sm text-[#6B778C] mt-0.5">{total.toLocaleString()} records</p>
        </div>
        {canCreate && (
          <Link href="/osc/new" className="jira-btn-primary">
            <Plus className="w-4 h-4" />
            Create request
          </Link>
        )}
      </div>

      <OscTable
        requests={requests}
        partners={partners}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        searchParams={searchParams}
        canEdit={canCreate}
      />
    </div>
  )
}
