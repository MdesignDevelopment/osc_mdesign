import Link from 'next/link'
import { AuditEntity, AuditAction, Role } from '@prisma/client'
import { ArrowRight, ExternalLink, History, Plus, Trash2 } from 'lucide-react'
import {
  cn, formatDate, formatDateTime, avatarColor,
  ROLE_LABELS, ROLE_LOZENGE, ADDRESS_STATUS_LABELS, DESIGN_STAGE_LABELS,
} from '@/lib/utils'
import { auditEntityHref, auditFieldLabels, AUDIT_ENTITY_LABELS } from '@/lib/audit'
import { EmptyState } from '@/components/shared/table-parts'

export interface AuditRow {
  id: string
  entity: AuditEntity
  entityId: string
  entityLabel: string
  action: AuditAction
  fieldChanged: string | null
  oldValue: string | null
  newValue: string | null
  changedAt: Date
  user: { id: string; name: string; role: Role }
}

function formatValue(entity: AuditEntity, field: string | null, value: string | null): string {
  if (!value) return '—'
  if (entity === 'ADDRESS_REQUEST' && field === 'status') {
    return ADDRESS_STATUS_LABELS[value as keyof typeof ADDRESS_STATUS_LABELS] ?? value
  }
  if (entity === 'DESIGN_SESSION' && field === 'stage') {
    return DESIGN_STAGE_LABELS[value as keyof typeof DESIGN_STAGE_LABELS] ?? value
  }
  if (field?.endsWith('Date')) return formatDate(value)
  if (field === 'notes' || field === 'actionsDone' || field === 'deleteReason') {
    return value.length > 80 ? value.slice(0, 80) + '…' : value
  }
  return value
}

const ACTION_STYLE: Record<AuditAction, { icon: typeof History; avatar: string; card: string }> = {
  CREATE: { icon: Plus, avatar: 'bg-emerald-500', card: 'border-neutral-200 hover:border-neutral-300' },
  UPDATE: { icon: History, avatar: '', card: 'border-neutral-200 hover:border-neutral-300' },
  DELETE: { icon: Trash2, avatar: 'bg-red-500', card: 'border-red-100 bg-red-50/30 hover:border-red-200' },
}

/**
 * Audit feed for the Design Session and Addresses trackers.
 *
 * Unlike the OSC tab, rows always stay readable after their subject is deleted:
 * entityLabel is snapshotted at write time and entityId is not a foreign key, so
 * there is no "Deleted request" placeholder to render.
 */
export function AuditLogList({ records }: { records: AuditRow[] }) {
  if (records.length === 0) {
    return (
      <EmptyState icon={History} title="No changes found" hint="Try adjusting your filters" />
    )
  }

  return (
    <div className="space-y-2">
      {records.map((record) => {
        const style = ACTION_STYLE[record.action]
        const Icon = style.icon
        const isSummary = record.fieldChanged === null
        const labels = auditFieldLabels(record.entity)
        const fieldLabel = record.fieldChanged
          ? labels[record.fieldChanged] ?? record.fieldChanged
          : null
        const isDeleted = record.action === 'DELETE'

        return (
          <div
            key={record.id}
            className={cn(
              'bg-white rounded-lg border px-4 py-3 flex items-start gap-3 transition-colors',
              style.card,
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5',
                style.avatar || avatarColor(record.user.name),
              )}
            >
              {record.action === 'UPDATE'
                ? record.user.name.charAt(0).toUpperCase()
                : <Icon className="w-3.5 h-3.5" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium text-neutral-800">{record.user.name}</span>
                <span
                  className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide',
                    ROLE_LOZENGE[record.user.role],
                  )}
                >
                  {ROLE_LABELS[record.user.role]}
                </span>

                {isSummary ? (
                  <span className="text-xs text-neutral-400">
                    {record.action === 'CREATE' ? 'created' : 'deleted'}
                  </span>
                ) : (
                  <>
                    <span className="text-xs text-neutral-400">
                      {record.action === 'CREATE' ? 'set' : 'changed'}
                    </span>
                    <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {fieldLabel}
                    </span>
                    <span className="text-xs text-neutral-400">on</span>
                  </>
                )}

                {isDeleted ? (
                  <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                    {record.entityLabel}
                  </span>
                ) : (
                  <Link
                    href={auditEntityHref(record.entity, record.entityId)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {record.entityLabel}
                  </Link>
                )}

                <span className="text-xs text-neutral-300">·</span>
                <span className="text-xs text-neutral-400">
                  {AUDIT_ENTITY_LABELS[record.entity]}
                </span>
              </div>

              {!isSummary && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {record.oldValue !== null && (
                    <>
                      <span className="text-xs text-neutral-400 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded line-through max-w-[220px] truncate">
                        {formatValue(record.entity, record.fieldChanged, record.oldValue)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-neutral-300 flex-shrink-0" />
                    </>
                  )}
                  <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded max-w-[220px] truncate">
                    {formatValue(record.entity, record.fieldChanged, record.newValue)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className="text-[11px] text-neutral-400 whitespace-nowrap tabular-nums">
                {formatDateTime(record.changedAt)}
              </span>
              {!isDeleted && (
                <Link
                  href={auditEntityHref(record.entity, record.entityId)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  View record
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
