import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { OscStatus, Priority } from '@prisma/client'
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

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  SUPPORT_ENGINEER: 'Support Engineer',
  EXTERN: 'External',
}

export const ROLE_LOZENGE = {
  ADMIN: 'bg-violet-600 text-white',
  SUPPORT_ENGINEER: 'bg-blue-600 text-white',
  EXTERN: 'bg-zinc-500 text-white',
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-600',
]

export function avatarColor(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}
