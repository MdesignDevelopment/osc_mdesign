import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Non-interactive table pieces, deliberately WITHOUT 'use client'.
//
// These are separate from ./table because Pagination takes a `buildHref`
// function prop, and server components cannot pass functions across a client
// boundary — React throws "Functions cannot be passed directly to Client
// Components". Keeping these server-safe lets /history render them directly,
// while the client tables can still import them freely.
//
// Anything needing an event handler or a hook belongs in ./table instead.

export function PlainTh({
  label, className, align = 'left', srOnly,
}: {
  label: string
  className?: string
  align?: 'left' | 'center' | 'right'
  srOnly?: boolean
}) {
  return (
    <th
      scope="col"
      className={cn(
        'jira-table-header',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className,
      )}
    >
      <span className={srOnly ? 'sr-only' : undefined}>{label}</span>
    </th>
  )
}

/** Check / dash cell for boolean columns — never raw true/false. */
export function BooleanCell({ value, label }: { value: boolean; label: string }) {
  return (
    <span className="inline-flex items-center justify-center w-full" title={label}>
      {value ? (
        <svg viewBox="0 0 16 16" className="w-4 h-4 text-blue-600" fill="none" aria-hidden="true">
          <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="text-neutral-300" aria-hidden="true">—</span>
      )}
      <span className="sr-only">{value ? `${label}: yes` : `${label}: no`}</span>
    </span>
  )
}

export function Pagination({
  page, totalPages, total, buildHref,
}: {
  page: number
  totalPages: number
  total: number
  buildHref: (p: number) => string
}) {
  if (totalPages <= 1) return null

  const start = Math.max(1, page <= 4 ? 1 : page - 3)
  const end = Math.min(totalPages, start + 6)

  return (
    <div className="flex items-center justify-between pt-1">
      <p className="text-xs text-neutral-400 tabular-nums">
        Page {page} of {totalPages} · {total.toLocaleString()} total
      </p>
      <div className="flex items-center gap-1">
        {page > 1 && (
          <Link href={buildHref(page - 1)} aria-label="Previous page" className="jira-btn-secondary text-xs py-1.5 px-2.5">
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        )}
        {Array.from({ length: end - start + 1 }, (_, i) => {
          const p = start + i
          return (
            <Link
              key={p}
              href={buildHref(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'text-xs py-1.5 px-3 rounded-md border transition-colors tabular-nums',
                p === page
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50',
              )}
            >
              {p}
            </Link>
          )
        })}
        {page < totalPages && (
          <Link href={buildHref(page + 1)} aria-label="Next page" className="jira-btn-secondary text-xs py-1.5 px-2.5">
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon, title, hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint: string
}) {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-14 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100 mb-3">
        <Icon className="w-5 h-5 text-neutral-300" />
      </div>
      <p className="text-sm font-medium text-neutral-500">{title}</p>
      <p className="text-xs text-neutral-400 mt-1">{hint}</p>
    </div>
  )
}
