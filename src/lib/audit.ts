import { Prisma, AuditEntity, AuditAction } from '@prisma/client'

// Shared field-level audit trail for the new modules.
//
// Follows the pattern already proven in the OSC module: diff old vs. new, then
// persist the resulting rows in the SAME $transaction as the mutation, so a
// committed change can never exist without its log entry.
//
// Two improvements over that original implementation:
//   - the audited field list is declared once, per module, instead of being
//     spread across a string loop and a date loop (which is how OSC ended up
//     never logging partnerId changes despite having a label for them);
//   - rows go in via a single createMany rather than N individual creates.
//
// See SPEC-WYER-MERKATOR.md §5.

export type AuditFieldType = 'string' | 'boolean' | 'date' | 'enum'

export interface FieldSpec {
  key: string
  type: AuditFieldType
}

export interface AuditChange {
  fieldChanged: string
  oldValue: string | null
  newValue: string | null
}

/**
 * Normalise a value to its stored audit string.
 *
 * Booleans become Yes/No and dates collapse to yyyy-MM-dd (matching the
 * existing OSC convention), so the history renderer stays free of per-type
 * branching and date-only fields do not produce phantom diffs from time
 * components.
 */
export function normaliseAuditValue(value: unknown, type: AuditFieldType): string | null {
  if (value === null || value === undefined || value === '') return null
  if (type === 'boolean') return value ? 'Yes' : 'No'
  if (type === 'date') {
    const d = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  }
  return String(value)
}

/**
 * Diff two records over a declared field list. Fields absent from `after` are
 * treated as unchanged, so this is safe for PATCH-style partial updates.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  specs: readonly FieldSpec[],
): AuditChange[] {
  const changes: AuditChange[] = []

  for (const { key, type } of specs) {
    if (!(key in after)) continue
    if (after[key] === undefined) continue

    const oldValue = normaliseAuditValue(before[key], type)
    const newValue = normaliseAuditValue(after[key], type)
    if (oldValue !== newValue) changes.push({ fieldChanged: key, oldValue, newValue })
  }

  return changes
}

/**
 * Initial values worth recording on CREATE.
 *
 * A plain diff against `{}` would emit a row for every field, including the
 * four booleans that default to false — four "→ No" entries on every new
 * record, which buries the values the user actually entered. Only fields with a
 * meaningful starting value are logged; the CREATE summary row carries the rest
 * of the story.
 */
export function initialFields(
  record: Record<string, unknown>,
  specs: readonly FieldSpec[],
): AuditChange[] {
  return diffFields({}, record, specs).filter(
    (c) => c.newValue !== null && c.newValue !== 'No',
  )
}

interface AuditRowArgs {
  entity: AuditEntity
  entityId: string
  /** Human-readable subject, snapshotted so deleted records stay readable. */
  entityLabel: string
  userId: string
  action: AuditAction
  changes?: readonly AuditChange[]
}

/**
 * Build AuditLog rows. Pass the result to `prisma.auditLog.createMany` inside
 * the mutation's transaction.
 *
 * CREATE and DELETE always emit one summary row (fieldChanged: null) even when
 * there are no field diffs, so the timeline always has an origin and an end.
 */
export function auditRows(args: AuditRowArgs): Prisma.AuditLogCreateManyInput[] {
  const { entity, entityId, entityLabel, userId, action, changes = [] } = args
  const base = { entity, entityId, entityLabel, userId }

  if (action === 'UPDATE') {
    return changes.map((c) => ({ ...base, action, ...c }))
  }

  // CREATE / DELETE: summary row, plus any accompanying detail rows (e.g. the
  // deletion reason, or the initial field values on create).
  return [
    { ...base, action, fieldChanged: null, oldValue: null, newValue: null },
    ...changes.map((c) => ({ ...base, action, ...c })),
  ]
}

// --- Field specs per module -------------------------------------------------

export const DESIGN_SESSION_FIELDS: readonly FieldSpec[] = [
  { key: 'popZone', type: 'string' },
  { key: 'cabinetName', type: 'string' },
  { key: 'mroPartner', type: 'string' },
  { key: 'notes', type: 'string' },
  { key: 'actionsDone', type: 'string' },
  { key: 'stage', type: 'enum' },
  { key: 'sendOcRequestToPartner', type: 'boolean' },
  { key: 'aapOnHold', type: 'boolean' },
  { key: 'readyToPost', type: 'boolean' },
  { key: 'posted', type: 'boolean' },
]

export const ADDRESS_REQUEST_FIELDS: readonly FieldSpec[] = [
  { key: 'requestDate', type: 'date' },
  { key: 'reporter', type: 'string' },
  { key: 'popName', type: 'string' },
  { key: 'tinaUuid', type: 'string' },
  { key: 'aapId', type: 'string' },
  { key: 'action', type: 'enum' },
  { key: 'notes', type: 'string' },
  { key: 'completionDate', type: 'date' },
]

// --- Display labels ---------------------------------------------------------

export const DESIGN_SESSION_FIELD_LABELS: Record<string, string> = {
  popZone: 'POP Zone',
  cabinetName: 'Cabinet Name',
  mroPartner: 'MRO Partner',
  notes: 'Notes',
  actionsDone: 'Actions Done',
  stage: 'Stage',
  sendOcRequestToPartner: 'Send OC Request to Partner',
  aapOnHold: 'AAP on Hold',
  readyToPost: 'Ready to Post',
  posted: 'Posted',
  deleteReason: 'Deletion Reason',
}

export const ADDRESS_REQUEST_FIELD_LABELS: Record<string, string> = {
  requestDate: 'Request Date',
  reporter: 'Reporter',
  popName: 'POP Name',
  tinaUuid: 'Tina UUID',
  aapId: 'AAP ID',
  action: 'Action',
  // Rows written before the Status → Action rename (migration 20260805000001)
  // carry fieldChanged: 'status'. The trail is never rewritten, so the retired
  // key keeps a label of its own rather than rendering as a raw column name.
  status: 'Action (recorded as Status)',
  notes: 'Notes',
  completionDate: 'Date of Completion',
  deleteReason: 'Deletion Reason',
}

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  DESIGN_SESSION: 'Design Session',
  ADDRESS_REQUEST: 'Address Request',
}

/** Detail-page route for an audited entity, used to link history rows. */
export function auditEntityHref(entity: AuditEntity, entityId: string): string {
  return entity === 'DESIGN_SESSION'
    ? `/design-sessions/${entityId}`
    : `/addresses/${entityId}`
}

export function auditFieldLabels(entity: AuditEntity): Record<string, string> {
  return entity === 'DESIGN_SESSION'
    ? DESIGN_SESSION_FIELD_LABELS
    : ADDRESS_REQUEST_FIELD_LABELS
}
