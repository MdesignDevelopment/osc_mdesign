'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { OscRequest, Partner, OscStatus, Priority } from '@prisma/client'
import { formatDate } from '@/lib/utils'
import { StatusLozenge, PriorityLozenge } from '@/components/ui/lozenge'
import { Search, ChevronLeft, ChevronRight, Pencil, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { useCallback, useTransition, useRef } from 'react'
import { cn } from '@/lib/utils'

type OscRow = OscRequest & { partner: Partner; createdBy: { name: string } }

interface OscTableProps {
  requests: OscRow[]
  partners: Partner[]
  total: number
  page: number
  pageSize: number
  searchParams: Record<string, string | undefined>
  canEdit: boolean
}

const ALL_STATUSES: { value: OscStatus; label: string }[] = [
  { value: 'OSC_UPDATED', label: 'OSC Updated' },
  { value: 'EMAIL_SENT', label: 'Email Sent' },
  { value: 'EMAIL_SENT_REMINDER', label: 'Email + Reminder' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CHECK_REMARKS', label: 'Check Remarks' },
]

function SortIcon({ active, dir }: { active: boolean; dir: string }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-400 transition-colors" />
  if (dir === 'asc') return <ArrowUp className="w-3 h-3 text-blue-500" />
  return <ArrowDown className="w-3 h-3 text-blue-500" />
}

function SortableTh({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: string
  currentSort: string
  currentDir: string
  onSort: (key: string) => void
  className?: string
}) {
  const active = currentSort === sortKey
  return (
    <th
      className={cn(
        'jira-table-header cursor-pointer select-none group transition-colors',
        active
          ? 'bg-blue-50/60 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400'
          : 'hover:bg-neutral-100 dark:hover:bg-white/[0.05]',
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <SortIcon active={active} dir={currentDir} />
      </div>
    </th>
  )
}

export function OscTable({ requests, partners, total, page, pageSize, searchParams, canEdit }: OscTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)

  const currentSort = searchParams.sort ?? ''
  const currentDir = searchParams.dir ?? 'asc'

  const buildParams = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams()
      Object.entries(searchParams).forEach(([k, v]) => {
        if (v && k !== 'page') params.set(k, v)
      })
      Object.entries(overrides).forEach(([k, v]) => {
        if (v) params.set(k, v)
        else params.delete(k)
      })
      return params.toString()
    },
    [searchParams],
  )

  const setParam = useCallback(
    (key: string, value: string) => {
      startTransition(() =>
        router.push(`${pathname}?${buildParams({ [key]: value })}`)
      )
    },
    [router, pathname, buildParams],
  )

  const handleSort = useCallback(
    (key: string) => {
      let newDir = 'asc'
      if (currentSort === key) {
        newDir = currentDir === 'asc' ? 'desc' : 'asc'
      }
      const params = new URLSearchParams()
      Object.entries(searchParams).forEach(([k, v]) => {
        if (v && k !== 'sort' && k !== 'dir' && k !== 'page') params.set(k, v)
      })
      params.set('sort', key)
      params.set('dir', newDir)
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [router, pathname, searchParams, currentSort, currentDir],
  )

  const clearFilters = () => {
    if (searchRef.current) searchRef.current.value = ''
    startTransition(() => router.push(pathname))
  }

  const hasFilters =
    searchParams.search ||
    searchParams.status ||
    searchParams.partner ||
    searchParams.priority ||
    searchParams.sort

  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const sharedSortProps = { currentSort, currentDir, onSort: handleSort }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white dark:bg-[#111] rounded-lg border border-neutral-200 dark:border-white/8 p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 bg-neutral-50 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-white/10 rounded-md px-3 py-2 flex-1 min-w-[220px] hover:border-neutral-300 dark:hover:border-white/20 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:ring-blue-500/30 transition-all">
            <Search className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search popzone, partner, remark..."
              defaultValue={searchParams.search ?? ''}
              onChange={(e) => setParam('search', e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600"
            />
          </div>

          <select
            value={searchParams.status ?? ''}
            onChange={(e) => setParam('status', e.target.value)}
            className="jira-input py-2 w-auto cursor-pointer"
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={searchParams.partner ?? ''}
            onChange={(e) => setParam('partner', e.target.value)}
            className="jira-input py-2 w-auto cursor-pointer"
          >
            <option value="">All Partners</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={searchParams.priority ?? ''}
            onChange={(e) => setParam('priority', e.target.value)}
            className="jira-input py-2 w-auto cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="HIGH_PRIO">High Priority</option>
            <option value="LOW_PRIO">Low Priority</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters} className="jira-btn-secondary py-2 text-xs gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#111] rounded-lg border border-neutral-200 dark:border-white/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-white/5">
                <SortableTh label="PopZone"     sortKey="popzone"       {...sharedSortProps} />
                <SortableTh label="Partner"     sortKey="partner"       {...sharedSortProps} />
                <SortableTh label="Status"      sortKey="status"        {...sharedSortProps} />
                <SortableTh label="Priority"    sortKey="priority"      {...sharedSortProps} />
                <SortableTh label="Received"    sortKey="receivedDate"  {...sharedSortProps} />
                <SortableTh label="OSC Request" sortKey="oscRequestDate" {...sharedSortProps} />
                <SortableTh label="Mail Sent"   sortKey="mailSentDate"  {...sharedSortProps} />
                <SortableTh label="Remark"      sortKey="remark"        {...sharedSortProps} className="max-w-[160px]" />
                <th className="jira-table-header w-8" />
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-neutral-400 dark:text-neutral-600 text-sm">
                    No OSC requests found
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-neutral-50 dark:border-white/[0.04] hover:bg-neutral-50/80 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="jira-table-cell whitespace-nowrap">
                      <Link
                        href={`/osc/${req.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline"
                      >
                        {req.popzone}
                      </Link>
                    </td>
                    <td className="jira-table-cell text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                      {req.partner.name}
                    </td>
                    <td className="jira-table-cell whitespace-nowrap">
                      <StatusLozenge status={req.status as OscStatus} />
                    </td>
                    <td className="jira-table-cell whitespace-nowrap">
                      <PriorityLozenge priority={req.priority as Priority} />
                    </td>
                    <td className="jira-table-cell text-neutral-400 dark:text-neutral-500 whitespace-nowrap tabular-nums">
                      {formatDate(req.receivedDate)}
                    </td>
                    <td className="jira-table-cell text-neutral-400 dark:text-neutral-500 whitespace-nowrap tabular-nums">
                      {formatDate(req.oscRequestDate)}
                    </td>
                    <td className="jira-table-cell text-neutral-400 dark:text-neutral-500 whitespace-nowrap tabular-nums">
                      {formatDate(req.mailSentDate)}
                    </td>
                    <td className="jira-table-cell text-neutral-400 dark:text-neutral-500 max-w-[160px]">
                      <span className="truncate block">{req.remark || '—'}</span>
                    </td>
                    <td className="jira-table-cell">
                      {canEdit && (
                        <Link
                          href={`/osc/${req.id}/edit`}
                          className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-white/8 inline-flex text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 dark:border-white/5">
            <span className="text-xs text-neutral-400 dark:text-neutral-600">
              {start}–{end} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setParam('page', String(page - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/8 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setParam('page', String(page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/8 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
