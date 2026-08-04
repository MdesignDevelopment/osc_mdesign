import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Role } from '@prisma/client'
import { can } from '@/lib/permissions'
import { buildAddressWhere, buildAddressOrderBy } from '@/lib/addresses'
import { AddressTable } from '@/components/addresses/address-table'
import { AddressFilters } from '@/components/addresses/address-filters'

const PAGE_SIZE = 25

interface PageProps {
  searchParams: {
    search?: string
    status?: string
    from?: string
    to?: string
    hideCompleted?: string
    page?: string
    sort?: string
    dir?: string
  }
}

export default async function AddressesPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const role = session.user.role as Role
  const canWrite = can(role, 'address:write')
  const canDelete = can(role, 'address:delete')

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const where = buildAddressWhere(searchParams)
  const orderBy = buildAddressOrderBy(searchParams.sort, searchParams.dir)

  const [requests, total, openCount] = await Promise.all([
    prisma.addressRequest.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.addressRequest.count({ where }),
    prisma.addressRequest.count({ where: { status: { not: 'COMPLETED' } } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Addresses</h1>
          <p className="text-sm text-neutral-400 mt-0.5 tabular-nums">
            {total.toLocaleString()} request{total !== 1 ? 's' : ''} shown · {openCount.toLocaleString()} open
          </p>
        </div>
        {canWrite && (
          <Link href="/addresses/new" className="jira-btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" />
            New Request
          </Link>
        )}
      </div>

      <AddressFilters current={searchParams} />

      <AddressTable
        requests={requests.map((r) => ({
          id: r.id,
          requestDate: r.requestDate.toISOString(),
          reporter: r.reporter,
          tinaUuid: r.tinaUuid,
          aapId: r.aapId,
          status: r.status,
          completionDate: r.completionDate?.toISOString() ?? null,
          updatedAt: r.updatedAt.toISOString(),
          createdByName: r.createdBy.name,
        }))}
        canWrite={canWrite}
        canDelete={canDelete}
        sort={searchParams.sort}
        dir={searchParams.dir}
        page={page}
        totalPages={totalPages}
        total={total}
        searchParams={searchParams}
      />
    </div>
  )
}
