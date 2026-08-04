import Link from 'next/link'
import { cn } from '@/lib/utils'

export type HistoryTabKey = 'OSC_REQUEST' | 'DESIGN_SESSION' | 'ADDRESS_REQUEST'

export interface HistoryTab {
  key: HistoryTabKey
  label: string
}

/**
 * Module tab strip. Only tabs the user holds the matching audit:read:*
 * capability for are rendered — and the page validates the `entity` param
 * server-side as well, so hiding a tab is never the only enforcement.
 */
export function HistoryTabs({
  tabs, active, preserved,
}: {
  tabs: readonly HistoryTab[]
  active: HistoryTabKey
  /** Filter params to carry across tab switches. */
  preserved: Record<string, string | undefined>
}) {
  // Only one tab visible means the strip is noise.
  if (tabs.length <= 1) return null

  function href(key: HistoryTabKey) {
    const params = new URLSearchParams()
    Object.entries(preserved).forEach(([k, v]) => { if (v) params.set(k, v) })
    // The subject-search param is module-specific, so it does not travel.
    params.delete('popzone')
    params.delete('label')
    params.delete('page')
    params.set('entity', key)
    return `/history?${params.toString()}`
  }

  return (
    <div className="flex items-center gap-0 border-b border-neutral-200">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={href(tab.key)}
          aria-current={tab.key === active ? 'page' : undefined}
          className={cn(
            'px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
            tab.key === active
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-400 hover:text-neutral-700',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
