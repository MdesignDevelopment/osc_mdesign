import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { OscStatus, Priority, Role, AddressAction, ScriptStatus, DesignStage } from '@prisma/client'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd/MM/yyyy')
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd/MM/yyyy HH:mm')
}

export const STATUS_LABELS: Record<OscStatus, string> = {
  OSC_UPDATED: 'OSC Updated',
  EMAIL_SENT: 'Email Sent',
  EMAIL_SENT_REMINDER: 'Email + Reminder',
  ON_HOLD: 'On Hold',
  CHECK_REMARKS: 'Check Remarks',
}

export const STATUS_LOZENGE: Record<OscStatus, string> = {
  OSC_UPDATED:
    'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800/50',
  EMAIL_SENT:
    'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-200 dark:ring-blue-800/50',
  EMAIL_SENT_REMINDER:
    'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-200 dark:ring-amber-800/50',
  ON_HOLD:
    'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400',
  CHECK_REMARKS:
    'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 ring-1 ring-inset ring-red-200 dark:ring-red-800/50',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  HIGH_PRIO: 'High Priority',
  MEDIUM_PRIO: 'Medium Priority',
  LOW_PRIO: 'Low Priority',
  NOT_DEFINED: 'Not defined',
}

export const PRIORITY_LOZENGE: Record<Priority, string> = {
  HIGH_PRIO:
    'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 ring-1 ring-inset ring-red-200 dark:ring-red-800/50',
  MEDIUM_PRIO:
    'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-200 dark:ring-amber-800/50',
  LOW_PRIO:
    'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400',
  NOT_DEFINED:
    'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500',
}

// Typed as Record<Role, string> deliberately: adding a value to the Role enum
// must be a compile error here, not a silent `undefined` in the sidebar and the
// history page. See SPEC-WYER-MERKATOR.md §1.5.
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  SUPPORT_ENGINEER: 'Support Engineer',
  EXTERN: 'External',
  WM_SUPPORT_ENGINEER: 'Wyer/Merkator Support Engineer',
}

/** Short forms for tight containers — the 220px sidebar footer truncates. */
export const ROLE_LABELS_SHORT: Record<Role, string> = {
  ADMIN: 'Admin',
  SUPPORT_ENGINEER: 'Support Engineer',
  EXTERN: 'External',
  WM_SUPPORT_ENGINEER: 'Wyer/Merkator',
}

export const ROLE_LOZENGE: Record<Role, string> = {
  ADMIN: 'bg-violet-600 text-white',
  SUPPORT_ENGINEER: 'bg-blue-600 text-white',
  EXTERN: 'bg-zinc-500 text-white',
  WM_SUPPORT_ENGINEER: 'bg-teal-600 text-white',
}

export const ADDRESS_ACTION_LABELS: Record<AddressAction, string> = {
  OFF_HOLD: 'Off Hold',
  ON_HOLD: 'On Hold',
}

export const ADDRESS_ACTION_LOZENGE: Record<AddressAction, string> = {
  OFF_HOLD: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  ON_HOLD: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
}

export const ADDRESS_ACTION_ORDER: readonly AddressAction[] = ['OFF_HOLD', 'ON_HOLD']

/**
 * Labels for values recorded before the Status → Action rename (migration
 * 20260805000001). Those AuditLog rows still hold the old enum names, and the
 * trail is never rewritten, so history needs its own lookup to stay readable.
 */
export const LEGACY_ADDRESS_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  ON_HOLD: 'On Hold',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
}

/**
 * Render a stored audit value for an address request. Handles both the current
 * `action` field and the legacy `status` rows behind it.
 */
export function formatAddressAuditValue(field: string | null, value: string): string {
  if (field === 'action') {
    return ADDRESS_ACTION_LABELS[value as AddressAction] ?? value
  }
  if (field === 'status') {
    return LEGACY_ADDRESS_STATUS_LABELS[value] ?? value
  }
  if (field === 'requestDate' || field === 'completionDate') return formatDate(value)
  return value
}

export const SCRIPT_STATUS_LABELS: Record<ScriptStatus, string> = {
  SUCCESS: 'Success',
  FAILED: 'Failed',
  PARTIAL: 'Partial',
  RUNNING: 'Running',
}

export const SCRIPT_STATUS_LOZENGE: Record<ScriptStatus, string> = {
  SUCCESS: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  FAILED: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200',
  PARTIAL: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  RUNNING: 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200',
}

// --- Design Session stage (spec §6.6) ---------------------------------------
//
// Stage is STORED and picked by hand. It used to be derived from the four
// boolean flags; that stopped being possible once "On report 3" entered the
// vocabulary — nothing in the flags expresses it. The flags stay, tracking
// separate facts, and move independently: a session can be On report 3 with
// Posted ticked, or Posted-the-stage with the Posted flag clear.

export const DESIGN_STAGE_LABELS: Record<DesignStage, string> = {
  IN_SESSION: 'In session',
  ON_REPORT_3: 'On report 3',
  POSTED: 'Posted',
}

export const DESIGN_STAGE_LOZENGE: Record<DesignStage, string> = {
  IN_SESSION: 'bg-zinc-100 text-zinc-500',
  ON_REPORT_3: 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200',
  POSTED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
}

/** Workflow order for pickers and sorting — not the enum's declaration order. */
export const DESIGN_STAGE_ORDER: readonly DesignStage[] = [
  'IN_SESSION', 'ON_REPORT_3', 'POSTED',
]

/** Normalised POP zone key. The single source of truth for this transform. */
export function popZoneKeyOf(popZone: string): string {
  return popZone.trim().toUpperCase()
}

// The Addresses ageing helpers (ageInDays / ageTone, spec §7.3) were removed
// along with the Age column they existed for. Request Date and Date of
// Completion are both still shown, so the figure can be reconstructed if it is
// ever wanted back.

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-600',
]

export function avatarColor(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}
