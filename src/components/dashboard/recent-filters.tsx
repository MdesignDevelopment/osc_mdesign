'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface RecentFiltersProps {
  partners: { id: string; name: string }[]
  currentSearch: string
  currentPartner: string
  currentTimeframe: string
}

const TIMEFRAMES = [
  { value: '', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

export function RecentFilters({
  partners,
  currentSearch,
  currentPartner,
  currentTimeframe,
}: RecentFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buildUrl = useCallback(
    (overrides: Partial<{ search: string; partner: string; timeframe: string }>) => {
      const search = overrides.search !== undefined ? overrides.search : currentSearch
      const partner = overrides.partner !== undefined ? overrides.partner : currentPartner
      const timeframe = overrides.timeframe !== undefined ? overrides.timeframe : currentTimeframe
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (partner) params.set('partner', partner)
      if (timeframe) params.set('timeframe', timeframe)
      return `${pathname}?${params.toString()}`
    },
    [pathname, currentSearch, currentPartner, currentTimeframe],
  )

  const handleSearch = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        router.push(buildUrl({ search: value }))
      }, 350)
    },
    [router, buildUrl],
  )

  const hasFilters = currentSearch || currentPartner || currentTimeframe

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Title + view all */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-800">Recent Requests</span>
        <Link href="/osc" className="text-xs text-blue-600 hover:text-blue-700 font-medium ml-1">
          View all →
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 min-w-[200px] focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search pop zone or partner…"
            defaultValue={currentSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Partner filter */}
        <select
          value={currentPartner}
          onChange={(e) => router.push(buildUrl({ partner: e.target.value }))}
          className="jira-input py-2 text-sm w-auto cursor-pointer min-w-[140px]"
        >
          <option value="">All Partners</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Timeframe pills */}
        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => router.push(buildUrl({ timeframe: tf.value }))}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                currentTimeframe === tf.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={() => {
              if (searchRef.current) searchRef.current.value = ''
              router.push(pathname)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-lg transition-colors hover:bg-slate-50"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
