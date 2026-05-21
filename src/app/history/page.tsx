import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { HistoryFilters } from '@/components/history/history-filters'
import {
  cn,
  formatDateTime,
  avatarColor,
  ROLE_LABELS,
  ROLE_LOZENGE,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/lib/utils'
import Link from 'next/link'
import { ArrowRight, ExternalLink, History, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

const PAGE_SIZE = 50

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  popzone: 'Pop Zone',
  remark: 'Remark',
  receivedDate: 'Received Date',
  oscRequestDate: 'OSC Request Date',
  mailSentDate: 'Mail Sent Date',
  updatedDate: 'Updated Date',
  partnerId: 'Partner',
}

function formatFieldValue(field: string, value: string | null | undefined): string {
  if (!value) return '—'
  if (field === 'status') return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value
  if (field === 'priority') return PRIORITY_LABELS[value as keyof typeof PRIORITY_LABELS] ?? value
  if (field.endsWith('Date')) {
    try { return format(new Date(value), 'dd/MM/yyyy') } catch { return value }
  }
  if (field === 'remark') return value.length > 80 ? value.slice(0, 80) + '…' : value
  return value
}

interface PageProps {
  searchParams: { user?: string; popzone?: string; from?: string; to?: string; page?: string }
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    ...(searchParams.user && { userId: searchParams.user }),
    ...(searchParams.popzone && {
      oscRequest: { popzone: { contains: searchParams.popzone, mode: 'insensitive' as const } },
    }),
    ...((searchParams.from || searchParams.to) && {
      changedAt: {
        ...(searchParams.from && { gte: new Date(searchParams.from + 'T00:00:00.000Z') }),
        ...(searchParams.to && { lte: new Date(searchParams.to + 'T23:59:59.999Z') }),
      },
    }),
  }

  const [records, total, users] = await Promise.all([
    prisma.oscHistory.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { changedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, role: true } },
        oscRequest: {
          select: { id: true, popzone: true, partner: { select: { name: true } } },
        },
      },
    }),
    prisma.oscHistory.count({ where }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildPageHref(p: number) {
    const params = new URLSearchParams()
    if (searchParams.user) params.set('user', searchParams.user)
    if (searchParams.popzone) params.set('popzone', searchParams.popzone)
    if (searchParams.from) params.set('from', searchParams.from)
    if (searchParams.to) params.set('to', searchParams.to)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/history${qs ? `?${qs}` : ''}`
  }

  const pageStart = Math.max(1, page <= 4 ? 1 : page - 3)
  const pageEnd = Math.min(totalPages, pageStart + 6)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Change History</h1>
        <p className="text-sm text-neutral-400 mt-0.5">
          {total.toLocaleString()} change{total !== 1 ? 's' : ''}
        </p>
      </div>

      <HistoryFilters users={users} current={searchParams} />

      {records.length === 0 ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-14 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100 mb-3">
            <History className="w-5 h-5 text-neutral-300" />
          </div>
          <p className="text-sm font-medium text-neutral-500">No changes found</p>
          <p className="text-xs text-neutral-400 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => {
            const initial = record.user.name.charAt(0).toUpperCase()
            const bg = avatarColor(record.user.name)
            const fieldLabel = FIELD_LABELS[record.fieldChanged] ?? record.fieldChanged
            const oldVal = formatFieldValue(record.fieldChanged, record.oldValue)
            const newVal = formatFieldValue(record.fieldChanged, record.newValue)

            return (
              <div
                key={record.id}
                className="bg-white rounded-lg border border-neutral-200 px-4 py-3 flex items-start gap-3 hover:border-neutral-300 transition-colors"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5',
                    bg,
                  )}
                >
                  {initial}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-neutral-800">{record.user.name}</span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide',
                        ROLE_LOZENGE[record.user.role as keyof typeof ROLE_LOZENGE],
                      )}
                    >
                      {ROLE_LABELS[record.user.role as keyof typeof ROLE_LABELS]}
                    </span>
                    <span className="text-xs text-neutral-400">changed</span>
                    <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {fieldLabel}
                    </span>
                    <span className="text-xs text-neutral-400">on</span>
                    <Link
                      href={`/osc/${record.oscRequest.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {record.oscRequest.popzone}
                    </Link>
                    <span className="text-xs text-neutral-300">·</span>
                    <span className="text-xs text-neutral-400">{record.oscRequest.partner.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-xs text-neutral-400 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded line-through max-w-[220px] truncate">
                      {oldVal}
                    </span>
                    <ArrowRight className="w-3 h-3 text-neutral-300 flex-shrink-0" />
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded max-w-[220px] truncate">
                      {newVal}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap tabular-nums">
                    {formatDateTime(record.changedAt)}
                  </span>
                  <Link
                    href={`/osc/${record.oscRequest.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                  >
                    View Popzone
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-neutral-400">
            Page {page} of {totalPages} · {total.toLocaleString()} total
          </p>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link href={buildPageHref(page - 1)} className="jira-btn-secondary text-xs py-1.5 px-2.5">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            )}
            {Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => {
              const p = pageStart + i
              return (
                <Link
                  key={p}
                  href={buildPageHref(p)}
                  className={cn(
                    'text-xs py-1.5 px-3 rounded-md border transition-colors',
                    p === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50',
                  )}
                >
                  {p}
                </Link>
              )
            })}
            {page < totalPages && (
              <Link href={buildPageHref(page + 1)} className="jira-btn-secondary text-xs py-1.5 px-2.5">
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
