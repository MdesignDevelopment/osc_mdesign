'use client'

import { useRouter } from 'next/navigation'
import { ROLE_LABELS } from '@/lib/utils'

interface User {
  id: string
  name: string
  role: string
}

interface Props {
  users: User[]
  current: { user?: string; popzone?: string; from?: string; to?: string }
}

export function HistoryFilters({ users, current }: Props) {
  const router = useRouter()

  function update(updates: Partial<typeof current>) {
    const params = new URLSearchParams()
    const merged = { ...current, ...updates }
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.delete('page')
    const qs = params.toString()
    router.push(`/history${qs ? `?${qs}` : ''}`)
  }

  const hasFilters = !!(current.user || current.popzone || current.from || current.to)

  return (
    <div className="bg-white rounded-lg border border-neutral-200 px-4 py-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">User</label>
          <select
            value={current.user ?? ''}
            onChange={(e) => update({ user: e.target.value })}
            className="jira-input text-xs py-1.5 min-w-[180px]"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Pop Zone</label>
          <input
            key={current.popzone ?? '__empty__'}
            type="text"
            placeholder="Search popzone…"
            defaultValue={current.popzone ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') update({ popzone: (e.target as HTMLInputElement).value })
            }}
            onBlur={(e) => {
              if (e.target.value !== (current.popzone ?? '')) {
                update({ popzone: e.target.value })
              }
            }}
            className="jira-input text-xs py-1.5 min-w-[180px]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">From</label>
          <input
            type="date"
            value={current.from ?? ''}
            onChange={(e) => update({ from: e.target.value })}
            className="jira-input text-xs py-1.5"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">To</label>
          <input
            type="date"
            value={current.to ?? ''}
            onChange={(e) => update({ to: e.target.value })}
            className="jira-input text-xs py-1.5"
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => router.push('/history')}
            className="jira-btn-secondary text-xs py-1.5 self-end"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
