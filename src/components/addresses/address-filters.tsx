'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { ADDRESS_STATUS_LABELS, ADDRESS_STATUS_ORDER } from '@/lib/utils'

interface Current {
  search?: string
  status?: string
  from?: string
  to?: string
  hideCompleted?: string
}

export function AddressFilters({ current }: { current: Current }) {
  const router = useRouter()

  function update(updates: Partial<Current>) {
    const params = new URLSearchParams()
    Object.entries({ ...current, ...updates }).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.delete('page')
    const qs = params.toString()
    router.push(`/addresses${qs ? `?${qs}` : ''}`)
  }

  // hideCompleted defaults to on, so its "filtered" state is the explicit '0'.
  const showingCompleted = current.hideCompleted === '0'
  const hasFilters = Boolean(current.search || current.status || current.from || current.to || showingCompleted)

  return (
    <div className="bg-white rounded-lg border border-neutral-200 px-4 py-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="addr-search" className="text-xs font-medium text-neutral-500">Search</label>
          <input
            id="addr-search"
            key={current.search ?? '__empty__'}
            type="text"
            placeholder="Reporter, Tina UUID, AAP ID…"
            defaultValue={current.search ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') update({ search: (e.target as HTMLInputElement).value })
            }}
            onBlur={(e) => {
              if (e.target.value !== (current.search ?? '')) update({ search: e.target.value })
            }}
            className="jira-input text-xs py-1.5 min-w-[220px]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="addr-status" className="text-xs font-medium text-neutral-500">Status</label>
          <select
            id="addr-status"
            value={current.status ?? ''}
            onChange={(e) => update({ status: e.target.value })}
            className="jira-input text-xs py-1.5 min-w-[150px]"
          >
            <option value="">All open</option>
            {ADDRESS_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{ADDRESS_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="addr-from" className="text-xs font-medium text-neutral-500">Requested from</label>
          <input
            id="addr-from"
            type="date"
            value={current.from ?? ''}
            onChange={(e) => update({ from: e.target.value })}
            className="jira-input text-xs py-1.5"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="addr-to" className="text-xs font-medium text-neutral-500">Requested to</label>
          <input
            id="addr-to"
            type="date"
            value={current.to ?? ''}
            onChange={(e) => update({ to: e.target.value })}
            className="jira-input text-xs py-1.5"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-600 pb-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showingCompleted}
            onChange={(e) => update({ hideCompleted: e.target.checked ? '0' : undefined })}
            className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500/20"
          />
          Show completed
        </label>

        {hasFilters && (
          <button
            onClick={() => router.push('/addresses')}
            className="jira-btn-secondary text-xs py-1.5 mb-0.5"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
