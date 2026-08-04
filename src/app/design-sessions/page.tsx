import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'
import { Role } from '@prisma/client'
import { can } from '@/lib/permissions'
import { buildDesignWhere, buildDesignOrderBy, wantsDuplicatesOnly } from '@/lib/design-sessions'
import { duplicatePopZoneKeys } from '@/lib/duplicate-popzones'
import { projectOscStatuses } from '@/lib/osc-status-lookup'
import { DesignSessionTable } from '@/components/design-sessions/design-session-table'
import { DesignSessionFilters } from '@/components/design-sessions/design-session-filters'

const PAGE_SIZE = 25

interface PageProps {
  searchParams: {
    search?: string
    partner?: string
    stage?: string
    hidePosted?: string
    dupes?: string
    page?: string
    sort?: string
    dir?: string
  }
}

export default async function DesignSessionsPage({ searchParams }: PageProps) {
  // The OSC Status projection must never be served stale from the router cache.
  noStore()

  const session = await getSession()
  if (!session) redirect('/login')

  const role = session.user.role as Role
  const canWrite = can(role, 'design:write')
  const canReadOsc = can(role, 'osc:read')

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))

  // Only paid for when the filter is on — it is a full scan of OscRequest.popzone.
  const dupeKeys = wantsDuplicatesOnly(searchParams) ? await duplicatePopZoneKeys() : undefined

  const where = buildDesignWhere(searchParams, dupeKeys)
  const orderBy = buildDesignOrderBy(searchParams.sort, searchParams.dir)

  const [sessions, total, openCount, partnerRows] = await Promise.all([
    prisma.designSession.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.designSession.count({ where }),
    prisma.designSession.count({ where: { posted: false } }),
    prisma.designSession.findMany({
      where: { mroPartner: { not: null } },
      distinct: ['mroPartner'],
      select: { mroPartner: true },
      orderBy: { mroPartner: 'asc' },
    }),
  ])

  // One batched query for the whole page — see lib/osc-status-lookup.
  const oscStatuses = await projectOscStatuses(sessions.map((s) => s.popZoneKey))

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const partners = partnerRows.map((p) => p.mroPartner!).filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Design Sessions</h1>
          <p className="text-sm text-neutral-400 mt-0.5 tabular-nums">
            {total.toLocaleString()} session{total !== 1 ? 's' : ''} shown · {openCount.toLocaleString()} not posted
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Link href="/design-sessions/import" className="jira-btn-secondary text-xs">
              <Upload className="w-3.5 h-3.5" />
              Bulk Import
            </Link>
            <Link href="/design-sessions/new" className="jira-btn-primary text-xs">
              <Plus className="w-3.5 h-3.5" />
              New Session
            </Link>
          </div>
        )}
      </div>

      <DesignSessionFilters current={searchParams} partners={partners} />

      <DesignSessionTable
        sessions={sessions.map((s) => ({
          id: s.id,
          popZone: s.popZone,
          popZoneKey: s.popZoneKey,
          cabinetName: s.cabinetName,
          mroPartner: s.mroPartner,
          stage: s.stage,
          sendOcRequestToPartner: s.sendOcRequestToPartner,
          aapOnHold: s.aapOnHold,
          readyToPost: s.readyToPost,
          posted: s.posted,
          updatedAt: s.updatedAt.toISOString(),
          oscStatus: oscStatuses.get(s.popZoneKey) ?? null,
        }))}
        canWrite={canWrite}
        canReadOsc={canReadOsc}
        partners={partners}
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
