import {
  AlertTriangle,
  TrendingUp,
  Timer,
  CalendarDays,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardsProps {
  total: number
  updated: number
  highPrio: number
  checkRemarks: number
  weeklyCount: number
  avgOscDays: number
  avgMailDays: number
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconClass,
  highlight,
  description,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  iconClass: string
  highlight?: 'rose' | 'amber'
  description?: string
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4 transition-all duration-150',
      highlight === 'rose'
        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
        : highlight === 'amber'
        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
        : 'bg-white dark:bg-[#111] border-neutral-200 dark:border-white/8',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 leading-none">
            {label}
          </p>
          <p className={cn(
            'text-[26px] font-bold tabular-nums mt-2 leading-none',
            highlight === 'rose'
              ? 'text-rose-600 dark:text-rose-400'
              : highlight === 'amber'
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-neutral-900 dark:text-neutral-100',
          )}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {description && (
            <p className="text-[11px] text-neutral-400 dark:text-neutral-600 mt-1.5 leading-tight">{description}</p>
          )}
        </div>
        <div className={cn('p-2 rounded-md flex-shrink-0', iconClass)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  iconClass,
  description,
  warn,
}: {
  label: string
  value: number
  unit: string
  icon: React.ElementType
  iconClass: string
  description: string
  warn?: boolean
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4 transition-all duration-150',
      warn
        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
        : 'bg-white dark:bg-[#111] border-neutral-200 dark:border-white/8',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 leading-none">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <p className={cn(
              'text-[26px] font-bold tabular-nums leading-none',
              warn ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-900 dark:text-neutral-100',
            )}>
              {value}
            </p>
            <span className={cn('text-xs font-medium', warn ? 'text-amber-500 dark:text-amber-500' : 'text-neutral-400 dark:text-neutral-500')}>
              {unit}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-600 mt-1.5 leading-tight">{description}</p>
        </div>
        <div className={cn('p-2 rounded-md flex-shrink-0', iconClass)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

export function StatsCards(props: StatsCardsProps) {
  const completionRate = props.total > 0 ? Math.round((props.updated / props.total) * 100) : 0
  const actionRequired = props.highPrio + props.checkRemarks

  return (
    <div className="space-y-3">
      {/* Completion overview */}
      <div className="bg-white dark:bg-[#111] rounded-lg border border-neutral-200 dark:border-white/8 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Overall Progress
            </p>
            {actionRequired > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-full px-2.5 py-0.5">
                <Zap className="w-3 h-3" />
                {actionRequired} need attention
              </span>
            )}
          </div>
          <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{completionRate}%</span>
        </div>
        <div className="w-full bg-neutral-100 dark:bg-white/8 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
            {props.updated.toLocaleString()} of {props.total.toLocaleString()} completed
          </span>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
            {(props.total - props.updated).toLocaleString()} remaining
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="High Priority"
          value={props.highPrio}
          icon={AlertTriangle}
          iconClass="bg-neutral-100 dark:bg-white/8 text-neutral-500 dark:text-neutral-400"
          description="Immediate action"
        />
        <MetricCard
          label="New This Week"
          value={props.weeklyCount}
          unit="requests"
          icon={TrendingUp}
          iconClass="bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
          description="Received in the last 7 days"
        />
        <MetricCard
          label="Avg OSC Processing"
          value={props.avgOscDays}
          unit="days"
          icon={Timer}
          iconClass="bg-cyan-100 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400"
          description="From OSC request to updated"
          warn={props.avgOscDays > 14}
        />
        <MetricCard
          label="Avg Mail Response"
          value={props.avgMailDays}
          unit="days"
          icon={CalendarDays}
          iconClass="bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400"
          description="From mail sent to received"
        />
      </div>
    </div>
  )
}
