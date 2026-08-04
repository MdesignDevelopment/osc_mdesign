'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { DESIGN_STAGE_LABELS, DESIGN_STAGE_ORDER } from '@/lib/utils'

interface Current {
  search?: string
  partner?: string
  stage?: string
  hidePosted?: string
  dupes?: string
}

export function DesignSessionFilters({
  current, partners,
}: {
  current: Current
  partners: string[]
}) {
  const router = useRouter()

  function update(updates: Partial<Current>) {
    const params = new URLSearchParams()
    Object.entries({ ...current, ...updates }).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.delete('page')
    const qs = params.toString()
    router.push(`/design-sessions${qs ? `?${qs}` : ''}`)
  }

  const showingPosted = current.hidePosted === '0'
  const dupesOnly = current.dupes === '1'
  const hasFilters = Boolean(
    current.search || current.partner || current.stage || showingPosted || dupesOnly,
  )

  return (
    <div className="bg-white rounded-lg border border-neutral-200 px-4 py-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="ds-search" className="text-xs font-medium text-neutral-500">Search</label>
          <input
            id="ds-search"
            key={current.search ?? '__empty__'}
            type="text"
            placeholder="POP zone or cabinet…"
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
          <label htmlFor="ds-partner" className="text-xs font-medium text-neutral-500">MRO Partner</label>
          <select
            id="ds-partner"
            value={current.partner ?? ''}
            onChange={(e) => update({ partner: e.target.value })}
            className="jira-input text-xs py-1.5 min-w-[150px]"
          >
            <option value="">All partners</option>
            {partners.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ds-stage" className="text-xs font-medium text-neutral-500">Stage</label>
          <select
            id="ds-stage"
            value={current.stage ?? ''}
            onChange={(e) => update({ stage: e.target.value })}
            className="jira-input text-xs py-1.5 min-w-[150px]"
          >
            <option value="">All stages</option>
            {DESIGN_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{DESIGN_STAGE_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-600 pb-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showingPosted}
            onChange={(e) => update({ hidePosted: e.target.checked ? '0' : undefined })}
            className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500/20"
          />
          Show posted
        </label>

        {/* A duplicate design session is impossible — popZoneKey is unique — so
            here "duplicate" means the POP zone carries more than one OSC
            request, i.e. the projected OSC Status is one of several (spec §6.4). */}
        <label
          className="flex items-center gap-2 text-xs text-neutral-600 pb-1.5 cursor-pointer"
          title="Only POP zones with more than one OSC request"
        >
          <input
            type="checkbox"
            checked={dupesOnly}
            onChange={(e) => update({ dupes: e.target.checked ? '1' : undefined })}
            className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500/20"
          />
          Duplicate POP zone
        </label>

        {hasFilters && (
          <button
            onClick={() => router.push('/design-sessions')}
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
