import { prisma } from '@/lib/db'
import { AuditEntity, Prisma } from '@prisma/client'
import { HistoryFilters } from './history-filters'
import { AuditLogList } from './audit-log-list'
import { Pagination } from '@/components/shared/table-parts'
import { AUDIT_ENTITY_LABELS } from '@/lib/audit'

// The Design Session / Addresses tabs of /history, backed by the generic
// AuditLog table. One query per tab, using the [entity, changedAt] index.

const PAGE_SIZE = 50

interface Props {
  entity: AuditEntity
  searchParams: {
    user?: string
    label?: string
    from?: string
    to?: string
    page?: string
    entity?: string
  }
}

export async function AuditHistoryView({ entity, searchParams }: Props) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const skip = (page - 1) * PAGE_SIZE

  const where: Prisma.AuditLogWhereInput = {
    entity,
    ...(searchParams.user && { userId: searchParams.user }),
    // entityLabel is a snapshot on the row itself, so searching by subject works
    // even for records that have since been deleted.
    ...(searchParams.label && {
      entityLabel: { contains: searchParams.label, mode: 'insensitive' as const },
    }),
    ...((searchParams.from || searchParams.to) && {
      changedAt: {
        ...(searchParams.from && { gte: new Date(searchParams.from + 'T00:00:00.000Z') }),
        ...(searchParams.to && { lte: new Date(searchParams.to + 'T23:59:59.999Z') }),
      },
    }),
  }

  const [records, total, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { changedAt: 'desc' },
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildPageHref(p: number) {
    const params = new URLSearchParams()
    params.set('entity', entity)
    if (searchParams.user) params.set('user', searchParams.user)
    if (searchParams.label) params.set('label', searchParams.label)
    if (searchParams.from) params.set('from', searchParams.from)
    if (searchParams.to) params.set('to', searchParams.to)
    if (p > 1) params.set('page', String(p))
    return `/history?${params.toString()}`
  }

  const searchLabel = entity === 'DESIGN_SESSION' ? 'POP Zone' : 'Tina UUID / AAP ID'

  return (
    <>
      <p className="text-sm text-neutral-400 tabular-nums">
        {total.toLocaleString()} change{total !== 1 ? 's' : ''} on{' '}
        {AUDIT_ENTITY_LABELS[entity].toLowerCase()}s
      </p>

      <HistoryFilters
        users={users}
        current={{ ...searchParams, entity }}
        searchKey="label"
        searchLabel={searchLabel}
        searchPlaceholder={`Search ${searchLabel.toLowerCase()}…`}
      />

      <AuditLogList records={records} />

      <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildPageHref} />
    </>
  )
}
