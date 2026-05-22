'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { OscRequest, Partner, OscStatus, Priority } from '@prisma/client'
import { formatDate } from '@/lib/utils'
import { StatusLozenge, PriorityLozenge } from '@/components/ui/lozenge'
import {
  Search, ChevronLeft, ChevronRight, Pencil, X,
  ArrowUp, ArrowDown, ArrowUpDown,
  FileDown, Clipboard, Mail, Check,
} from 'lucide-react'
import { useCallback, useTransition, useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { MailPresetDialog } from './mail-preset-dialog'

type OscRow = OscRequest & { partner: Partner; createdBy: { name: string } }

interface OscTableProps {
  requests: OscRow[]
  partners: Partner[]
  total: number
  page: number
  pageSize: number
  searchParams: Record<string, string | undefined>
  canEdit: boolean
  currentUserName: string
}

const ALL_STATUSES: { value: OscStatus; label: string }[] = [
  { value: 'OSC_UPDATED', label: 'OSC Updated' },
  { value: 'EMAIL_SENT', label: 'Email Sent' },
  { value: 'EMAIL_SENT_REMINDER', label: 'Email + Reminder' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CHECK_REMARKS', label: 'Check Remarks' },
]

const STATUS_LABELS: Record<string, string> = {
  OSC_UPDATED: 'OSC Updated',
  EMAIL_SENT: 'Email Sent',
  EMAIL_SENT_REMINDER: 'Email + Reminder',
  ON_HOLD: 'On Hold',
  CHECK_REMARKS: 'Check Remarks',
}

const PRIORITY_LABELS: Record<string, string> = {
  HIGH_PRIO: 'High Priority',
  MEDIUM_PRIO: 'Medium Priority',
  LOW_PRIO: 'Low Priority',
  NOT_DEFINED: 'Not defined',
}

function SortIcon({ active, dir }: { active: boolean; dir: string }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-400 transition-colors" />
  if (dir === 'asc') return <ArrowUp className="w-3 h-3 text-blue-500" />
  return <ArrowDown className="w-3 h-3 text-blue-500" />
}

function SortableTh({
  label, sortKey, currentSort, currentDir, onSort, className,
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

export function OscTable({ requests, partners, total, page, pageSize, searchParams, canEdit, currentUserName }: OscTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mailPresetOpen, setMailPresetOpen] = useState(false)
  const [popzoneCopied, setPopzoneCopied] = useState(false)

  const currentSort = searchParams.sort ?? ''
  const currentDir = searchParams.dir ?? 'asc'

  // Clear selection when page or filters change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [page, searchParams.search, searchParams.status, searchParams.partner, searchParams.priority, searchParams.sort])

  // Sync indeterminate state on select-all checkbox
  useEffect(() => {
    if (!selectAllRef.current) return
    const all = requests.length > 0 && selectedIds.size === requests.length
    const some = selectedIds.size > 0 && selectedIds.size < requests.length
    selectAllRef.current.indeterminate = some
    selectAllRef.current.checked = all
  }, [selectedIds, requests])

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds(
      selectedIds.size === requests.length ? new Set() : new Set(requests.map((r) => r.id)),
    )
  }

  const handleExportSelected = async () => {
    const XLSX = await import('xlsx')
    const fmtDate = (d: Date | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '')
    const selected = requests.filter((r) => selectedIds.has(r.id))
    const rows = selected.map((r) => ({
      'Pop Zone': r.popzone,
      'Partner': r.partner.name,
      'Status': STATUS_LABELS[r.status] ?? r.status,
      'Priority': r.priority ? (PRIORITY_LABELS[r.priority] ?? r.priority) : '',
      'Remark': r.remark ?? '',
      'OSC Request Date': fmtDate(r.oscRequestDate),
      'Mail Sent Date': fmtDate(r.mailSentDate),
      'Received Date': fmtDate(r.receivedDate),
      'Updated Date': fmtDate(r.updatedDate),
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 26 }, { wch: 22 }, { wch: 20 }, { wch: 16 },
      { wch: 40 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'OSC Requests')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `osc-export-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopyPopzones = async () => {
    const text = requests
      .filter((r) => selectedIds.has(r.id))
      .map((r) => r.popzone)
      .join('\n')
    await navigator.clipboard.writeText(text)
    setPopzoneCopied(true)
    setTimeout(() => setPopzoneCopied(false), 2000)
  }

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
      startTransition(() => router.push(`${pathname}?${buildParams({ [key]: value })}`))
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

  const selectedRows = requests.filter((r) => selectedIds.has(r.id))

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
                <th className="jira-table-header w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-blue-600 cursor-pointer accent-blue-600"
                    aria-label="Select all"
                  />
                </th>
                <SortableTh label="PopZone"     sortKey="popzone"        {...sharedSortProps} />
                <SortableTh label="Partner"     sortKey="partner"        {...sharedSortProps} />
                <SortableTh label="Status"      sortKey="status"         {...sharedSortProps} />
                <SortableTh label="Priority"    sortKey="priority"       {...sharedSortProps} />
                <SortableTh label="OSC Request" sortKey="oscRequestDate" {...sharedSortProps} />
                <SortableTh label="Mail Sent"   sortKey="mailSentDate"   {...sharedSortProps} />
                <SortableTh label="Received"    sortKey="receivedDate"   {...sharedSortProps} />
                <SortableTh label="Remark"      sortKey="remark"         {...sharedSortProps} className="max-w-[160px]" />
                <th className="jira-table-header w-8" />
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-neutral-400 dark:text-neutral-600 text-sm">
                    No OSC requests found
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const selected = selectedIds.has(req.id)
                  return (
                    <tr
                      key={req.id}
                      className={cn(
                        'border-b border-neutral-50 dark:border-white/[0.04] transition-colors',
                        selected
                          ? 'bg-blue-50/50 dark:bg-blue-950/10'
                          : 'hover:bg-neutral-50/80 dark:hover:bg-white/[0.03]',
                      )}
                    >
                      <td className="jira-table-cell w-10">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(req.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-blue-600 cursor-pointer accent-blue-600"
                          aria-label={`Select ${req.popzone}`}
                        />
                      </td>
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
                        {formatDate(req.oscRequestDate)}
                      </td>
                      <td className="jira-table-cell text-neutral-400 dark:text-neutral-500 whitespace-nowrap tabular-nums">
                        {formatDate(req.mailSentDate)}
                      </td>
                      <td className="jira-table-cell text-neutral-400 dark:text-neutral-500 whitespace-nowrap tabular-nums">
                        {formatDate(req.receivedDate)}
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
                  )
                })
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

      {/* Floating selection bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/40 px-2 py-1.5">
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 px-2 py-1 tabular-nums">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-4 bg-neutral-200 dark:bg-white/10 mx-1" />
          <button
            onClick={handleExportSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-white/8 rounded-lg transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            onClick={handleCopyPopzones}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              popzoneCopied
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-white/8',
            )}
          >
            {popzoneCopied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
            {popzoneCopied ? 'Copied!' : 'Copy PopZones'}
          </button>
          <button
            onClick={() => setMailPresetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-white/8 rounded-lg transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Mail Preset
          </button>
          <div className="w-px h-4 bg-neutral-200 dark:bg-white/10 mx-1" />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/8 rounded-lg transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mail preset dialog */}
      <MailPresetDialog
        open={mailPresetOpen}
        selectedRows={selectedRows.map((r) => ({
          id: r.id,
          popzone: r.popzone,
          priority: r.priority,
          status: r.status,
        }))}
        canEdit={canEdit}
        userName={currentUserName}
        onClose={() => setMailPresetOpen(false)}
        onRefresh={() => startTransition(() => router.refresh())}
      />
    </div>
  )
}
