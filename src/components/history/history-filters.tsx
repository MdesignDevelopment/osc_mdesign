'use client'

import { useRouter } from 'next/navigation'
import { ROLE_LABELS } from '@/lib/utils'
import { Role } from '@prisma/client'

interface User {
  id: string
  name: string
  role: string
}

export interface HistoryFilterState {
  user?: string
  popzone?: string
  label?: string
  from?: string
  to?: string
  entity?: string
}

interface Props {
  users: User[]
  current: HistoryFilterState
  /** Which query param holds the free-text search for the active tab. */
  searchKey?: 'popzone' | 'label'
  searchLabel?: string
  searchPlaceholder?: string
}

export function HistoryFilters({
  users,
  current,
  searchKey = 'popzone',
  searchLabel = 'Pop Zone',
  searchPlaceholder = 'Search popzone…',
}: Props) {
  const router = useRouter()

  function update(updates: Partial<HistoryFilterState>) {
    const params = new URLSearchParams()
    const merged = { ...current, ...updates }
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.delete('page')
    const qs = params.toString()
    router.push(`/history${qs ? `?${qs}` : ''}`)
  }

  function clearFilters() {
    // The active tab is not a filter — clearing must not silently move the user
    // to a module they may not have access to.
    const params = new URLSearchParams()
    if (current.entity) params.set('entity', current.entity)
    const qs = params.toString()
    router.push(`/history${qs ? `?${qs}` : ''}`)
  }

  const searchValue = current[searchKey] ?? ''
  const hasFilters = Boolean(
    current.user || current.popzone || current.label || current.from || current.to,
  )

  return (
    <div className="bg-white rounded-lg border border-neutral-200 px-4 py-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="hist-user" className="text-xs font-medium text-neutral-500">User</label>
          <select
            id="hist-user"
            value={current.user ?? ''}
            onChange={(e) => update({ user: e.target.value })}
            className="jira-input text-xs py-1.5 min-w-[180px]"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {ROLE_LABELS[u.role as Role] ?? u.role}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="hist-search" className="text-xs font-medium text-neutral-500">
            {searchLabel}
          </label>
          <input
            id="hist-search"
            key={`${searchKey}-${searchValue || '__empty__'}`}
            type="text"
            placeholder={searchPlaceholder}
            defaultValue={searchValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') update({ [searchKey]: (e.target as HTMLInputElement).value })
            }}
            onBlur={(e) => {
              if (e.target.value !== searchValue) update({ [searchKey]: e.target.value })
            }}
            className="jira-input text-xs py-1.5 min-w-[180px]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="hist-from" className="text-xs font-medium text-neutral-500">From</label>
          <input
            id="hist-from"
            type="date"
            value={current.from ?? ''}
            onChange={(e) => update({ from: e.target.value })}
            className="jira-input text-xs py-1.5"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="hist-to" className="text-xs font-medium text-neutral-500">To</label>
          <input
            id="hist-to"
            type="date"
            value={current.to ?? ''}
            onChange={(e) => update({ to: e.target.value })}
            className="jira-input text-xs py-1.5"
          />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="jira-btn-secondary text-xs py-1.5 self-end">
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
