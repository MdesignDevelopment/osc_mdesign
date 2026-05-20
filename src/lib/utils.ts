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
  OSC_UPDATED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  EMAIL_SENT: 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200',
  EMAIL_SENT_REMINDER: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  ON_HOLD: 'bg-slate-100 text-slate-500',
  CHECK_REMARKS: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  HIGH_PRIO: 'High Priority',
  MEDIUM_PRIO: 'Medium Priority',
  LOW_PRIO: 'Low Priority',
  NOT_DEFINED: 'Not defined',
}

export const PRIORITY_LOZENGE: Record<Priority, string> = {
  HIGH_PRIO: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200',
  MEDIUM_PRIO: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  LOW_PRIO: 'bg-slate-100 text-slate-500',
  NOT_DEFINED: 'bg-slate-100 text-slate-400',
}

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  SUPPORT_ENGINEER: 'Support Engineer',
  EXTERN: 'External',
}

export const ROLE_LOZENGE = {
  ADMIN: 'bg-violet-600 text-white',
  SUPPORT_ENGINEER: 'bg-blue-600 text-white',
  EXTERN: 'bg-slate-500 text-white',
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-600',
]

export function avatarColor(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}
