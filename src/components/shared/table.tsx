'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Interactive table pieces only. Non-interactive ones (PlainTh, BooleanCell,
// Pagination, EmptyState) live in ./table-parts without a 'use client'
// directive, so server components can render them and pass function props.

export function SortIcon({ active, dir }: { active: boolean; dir: string }) {
  if (!active) {
    return <ArrowUpDown className="w-3 h-3 text-neutral-300 group-hover:text-neutral-400 transition-colors" />
  }
  return dir === 'asc'
    ? <ArrowUp className="w-3 h-3 text-blue-500" />
    : <ArrowDown className="w-3 h-3 text-blue-500" />
}

export function SortableTh({
  label, sortKey, currentSort, currentDir, onSort, className, align = 'left',
}: {
  label: string
  sortKey: string
  currentSort: string
  currentDir: string
  onSort: (key: string) => void
  className?: string
  align?: 'left' | 'center' | 'right'
}) {
  const active = currentSort === sortKey
  return (
    <th
      scope="col"
      aria-sort={active ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'jira-table-header cursor-pointer select-none group transition-colors',
        active ? 'bg-blue-50/60 text-blue-600' : 'hover:bg-neutral-100',
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1',
          align === 'center' && 'justify-center w-full',
          align === 'right' && 'justify-end w-full',
        )}
      >
        {label}
        <SortIcon active={active} dir={currentDir} />
      </span>
    </th>
  )
}

/** Polite live region for optimistic-update failures (spec §9 a11y). */
export function LiveRegion({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" role="status" className="sr-only">
      {message ?? ''}
    </div>
  )
}
