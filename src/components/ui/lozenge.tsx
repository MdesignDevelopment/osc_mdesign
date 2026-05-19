import { cn } from '@/lib/utils'
import { OscStatus, Priority, Role } from '@prisma/client'
import { STATUS_LABELS, STATUS_LOZENGE, PRIORITY_LABELS, PRIORITY_LOZENGE, ROLE_LABELS, ROLE_LOZENGE } from '@/lib/utils'

interface LozengeProps {
  className?: string
  children: React.ReactNode
  color: string
}

export function Lozenge({ children, color, className }: LozengeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap',
      color,
      className
    )}>
      {children}
    </span>
  )
}

export function StatusLozenge({ status }: { status: OscStatus | string }) {
  return (
    <Lozenge color={STATUS_LOZENGE[status as OscStatus] ?? 'bg-slate-100 text-slate-500'}>
      {STATUS_LABELS[status as OscStatus] ?? status}
    </Lozenge>
  )
}

export function PriorityLozenge({ priority }: { priority: Priority | string | null | undefined }) {
  if (!priority) return null
  return (
    <Lozenge color={PRIORITY_LOZENGE[priority as Priority] ?? 'bg-slate-100 text-slate-500'}>
      {PRIORITY_LABELS[priority as Priority] ?? priority}
    </Lozenge>
  )
}

export function RoleLozenge({ role }: { role: Role | string }) {
  return (
    <Lozenge color={ROLE_LOZENGE[role as Role] ?? 'bg-slate-500 text-white'}>
      {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
    </Lozenge>
  )
}
