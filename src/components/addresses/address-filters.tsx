'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { ADDRESS_ACTION_LABELS, ADDRESS_ACTION_ORDER } from '@/lib/utils'

interface Current {
  search?: string
  action?: string
  from?: string
  to?: string
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

  const hasFilters = Boolean(current.search || current.action || current.from || current.to)

  return (
    <div className="bg-white rounded-lg border border-neutral-200 px-4 py-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="addr-search" className="text-xs font-medium text-neutral-500">Search</label>
          <input
            id="addr-search"
            key={current.search ?? '__empty__'}
            type="text"
            placeholder="Reporter, POP name, Tina UUID, AAP ID…"
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
          <label htmlFor="addr-action" className="text-xs font-medium text-neutral-500">Action</label>
          <select
            id="addr-action"
            value={current.action ?? ''}
            onChange={(e) => update({ action: e.target.value })}
            className="jira-input text-xs py-1.5 min-w-[150px]"
          >
            <option value="">All</option>
            {ADDRESS_ACTION_ORDER.map((a) => (
              <option key={a} value={a}>{ADDRESS_ACTION_LABELS[a]}</option>
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
