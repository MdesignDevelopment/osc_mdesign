import { prisma } from '@/lib/db'
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
import { ArrowRight, ExternalLink, History, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Role } from '@prisma/client'
import { HistoryFilters } from './history-filters'
import { Pagination, EmptyState } from '@/components/shared/table-parts'

// The OSC tab of /history. Moved verbatim out of app/history/page.tsx when the
// page became module-tabbed; it still queries OscHistory directly, which is left
// untouched by the new generic AuditLog (spec §1.4).

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
  deleted: 'Request',
  deleteReason: 'Deletion Reason',
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

interface Props {
  searchParams: { user?: string; popzone?: string; from?: string; to?: string; page?: string; entity?: string }
}

export async function OscHistoryView({ searchParams }: Props) {
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
    if (searchParams.entity) params.set('entity', searchParams.entity)
    if (searchParams.user) params.set('user', searchParams.user)
    if (searchParams.popzone) params.set('popzone', searchParams.popzone)
    if (searchParams.from) params.set('from', searchParams.from)
    if (searchParams.to) params.set('to', searchParams.to)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/history${qs ? `?${qs}` : ''}`
  }

  return (
    <>
      <p className="text-sm text-neutral-400 tabular-nums">
        {total.toLocaleString()} change{total !== 1 ? 's' : ''}
      </p>

      <HistoryFilters
        users={users}
        current={searchParams}
        searchKey="popzone"
        searchLabel="Pop Zone"
        searchPlaceholder="Search popzone…"
      />

      {records.length === 0 ? (
        <EmptyState icon={History} title="No changes found" hint="Try adjusting your filters" />
      ) : (
        <div className="space-y-2">
          {records.map((record) => {
            const initial = record.user.name.charAt(0).toUpperCase()
            const bg = avatarColor(record.user.name)
            const isDeleted = record.fieldChanged === 'deleted'
            const isDeleteReason = record.fieldChanged === 'deleteReason'
            const fieldLabel = FIELD_LABELS[record.fieldChanged] ?? record.fieldChanged
            const oldVal = formatFieldValue(record.fieldChanged, record.oldValue)
            const newVal = formatFieldValue(record.fieldChanged, record.newValue)
            const popzone = isDeleted
              ? (record.oldValue ?? 'Unknown')
              : (record.oscRequest?.popzone ?? 'Deleted request')
            const partnerName = isDeleted
              ? (record.newValue ?? '')
              : (record.oscRequest?.partner?.name ?? '')

            if (isDeleteReason) {
              return (
                <div
                  key={record.id}
                  className="bg-red-50/20 rounded-lg border border-red-100 px-4 py-2.5 flex items-start gap-3"
                >
                  <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center mt-0.5">
                    <div className="w-px bg-red-200 mx-auto" style={{ height: 20 }} />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide">Reason</span>
                    <span className="text-[12.5px] text-neutral-600 italic">
                      {record.newValue ?? '—'}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap tabular-nums flex-shrink-0">
                    {formatDateTime(record.changedAt)}
                  </span>
                </div>
              )
            }

            return (
              <div
                key={record.id}
                className={cn(
                  'bg-white rounded-lg border px-4 py-3 flex items-start gap-3 transition-colors',
                  isDeleted
                    ? 'border-red-100 bg-red-50/30 hover:border-red-200'
                    : 'border-neutral-200 hover:border-neutral-300',
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5',
                    isDeleted ? 'bg-red-500' : bg,
                  )}
                >
                  {isDeleted ? <Trash2 className="w-3.5 h-3.5" /> : initial}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-neutral-800">{record.user.name}</span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide',
                        ROLE_LOZENGE[record.user.role as Role],
                      )}
                    >
                      {ROLE_LABELS[record.user.role as Role]}
                    </span>
                    {isDeleted ? (
                      <>
                        <span className="text-xs text-neutral-400">deleted</span>
                        <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                          {popzone}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-neutral-400">changed</span>
                        <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                          {fieldLabel}
                        </span>
                        <span className="text-xs text-neutral-400">on</span>
                        {record.oscRequest ? (
                          <Link
                            href={`/osc/${record.oscRequest.id}`}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {popzone}
                          </Link>
                        ) : (
                          <span className="text-xs font-medium text-neutral-400 line-through">
                            {popzone}
                          </span>
                        )}
                      </>
                    )}
                    <span className="text-xs text-neutral-300">·</span>
                    <span className="text-xs text-neutral-400">{partnerName}</span>
                  </div>

                  {!isDeleted && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-xs text-neutral-400 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded line-through max-w-[220px] truncate">
                        {oldVal}
                      </span>
                      <ArrowRight className="w-3 h-3 text-neutral-300 flex-shrink-0" />
                      <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded max-w-[220px] truncate">
                        {newVal}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap tabular-nums">
                    {formatDateTime(record.changedAt)}
                  </span>
                  {!isDeleted && record.oscRequest && (
                    <Link
                      href={`/osc/${record.oscRequest.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                    >
                      View Popzone
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildPageHref} />
    </>
  )
}
