import { AuditAction } from '@prisma/client'
import { History, Plus, Trash2 } from 'lucide-react'
import { formatDateTime, avatarColor, ROLE_LABELS, cn } from '@/lib/utils'
import { Role } from '@prisma/client'

// Module-agnostic audit trail renderer.
//
// Generalised from components/osc/osc-timeline (same visual language: avatar,
// actor, role lozenge, old→new chips, right-aligned timestamp) but decoupled
// from the OSC Prisma types and from its hardcoded field-label map. Field
// labels and value formatting come in as props so each module owns its own
// vocabulary. See SPEC-WYER-MERKATOR.md §5.3.
//
// A comments slot is deliberately absent: neither new module has comments in
// scope. The entries array is the only input, so adding a comment stream later
// is additive rather than a rewrite.

export interface AuditEntry {
  id: string
  action: AuditAction
  fieldChanged: string | null
  oldValue: string | null
  newValue: string | null
  changedAt: Date | string
  user: { name: string; role: Role }
}

interface AuditTimelineProps {
  entries: AuditEntry[]
  fieldLabels: Record<string, string>
  /** Renders a stored audit string for display (enum keys → labels, etc.). */
  formatValue?: (field: string | null, value: string) => string
  /** What was created/deleted, e.g. "design session". */
  subjectNoun?: string
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
        avatarColor(name),
      )}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

const ACTION_ICON: Record<AuditAction, { icon: typeof History; wrapper: string; tone: string }> = {
  CREATE: { icon: Plus, wrapper: 'bg-emerald-50 border-emerald-200', tone: 'text-emerald-500' },
  UPDATE: { icon: History, wrapper: 'bg-amber-50 border-amber-200', tone: 'text-amber-500' },
  DELETE: { icon: Trash2, wrapper: 'bg-red-50 border-red-200', tone: 'text-red-500' },
}

export function AuditTimeline({
  entries,
  fieldLabels,
  formatValue = (_f, v) => v,
  subjectNoun = 'record',
}: AuditTimelineProps) {
  return (
    <div className="jira-panel">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <p className="jira-section-header">History</p>
        <span className="text-xs text-slate-400 tabular-nums">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="p-4">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No changes recorded yet</p>
        ) : (
          <div className="relative space-y-5">
            {/* Vertical connector */}
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-100" />

            {entries.map((entry) => {
              const { icon: Icon, wrapper, tone } = ACTION_ICON[entry.action]
              const isSummary = entry.fieldChanged === null
              const label = entry.fieldChanged
                ? fieldLabels[entry.fieldChanged] ?? entry.fieldChanged
                : null

              return (
                <div key={entry.id} className="flex gap-3 relative z-10">
                  <div
                    className={cn(
                      'w-8 h-8 border rounded-full flex items-center justify-center flex-shrink-0',
                      wrapper,
                    )}
                  >
                    <Icon className={cn('w-3.5 h-3.5', tone)} />
                  </div>

                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{entry.user.name}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {ROLE_LABELS[entry.user.role]}
                      </span>

                      {isSummary ? (
                        <span className="text-sm text-slate-700">
                          {entry.action === 'CREATE' ? 'created' : 'deleted'} this {subjectNoun}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-700">
                          {entry.action === 'CREATE' ? 'set ' : 'changed '}
                          <span className="font-medium">{label}</span>
                        </span>
                      )}

                      <span className="text-xs text-slate-400 tabular-nums">
                        {formatDateTime(entry.changedAt)}
                      </span>
                    </div>

                    {!isSummary && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {entry.oldValue !== null && (
                          <>
                            <span className="bg-red-50 text-red-600 px-1.5 py-0.5 text-xs font-medium rounded line-through max-w-[260px] truncate">
                              {formatValue(entry.fieldChanged, entry.oldValue)}
                            </span>
                            <span className="text-slate-300 text-xs">→</span>
                          </>
                        )}
                        <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 text-xs font-medium rounded max-w-[260px] truncate">
                          {entry.newValue === null ? '—' : formatValue(entry.fieldChanged, entry.newValue)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
