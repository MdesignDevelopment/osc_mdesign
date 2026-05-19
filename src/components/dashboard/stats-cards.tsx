import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Mail,
  MessageSquare,
  FileText,
  TrendingUp,
  Timer,
  CalendarDays,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardsProps {
  total: number
  updated: number
  onHold: number
  highPrio: number
  emailSent: number
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
  cardClass,
  accentClass,
  description,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  iconClass: string
  cardClass?: string
  accentClass?: string
  description?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm p-5 hover:shadow-md transition-all duration-200 relative overflow-hidden',
        cardClass ?? 'bg-white border-slate-100',
      )}
    >
      {accentClass && (
        <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', accentClass)} />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">
            {label}
          </p>
          <p className="text-[28px] font-bold text-slate-900 tabular-nums mt-2 leading-none">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {description && (
            <p className="text-[11px] text-slate-400 mt-1.5 leading-tight">{description}</p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-xl flex-shrink-0 mt-0.5', iconClass)}>
          <Icon className="w-[18px] h-[18px]" />
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
    <div
      className={cn(
        'rounded-xl border shadow-sm p-5 hover:shadow-md transition-all duration-200',
        warn ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-100',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <p
              className={cn(
                'text-[28px] font-bold tabular-nums leading-none',
                warn ? 'text-amber-700' : 'text-slate-900',
              )}
            >
              {value}
            </p>
            <span className={cn('text-sm font-semibold', warn ? 'text-amber-500' : 'text-slate-400')}>
              {unit}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-tight">{description}</p>
        </div>
        <div className={cn('p-2.5 rounded-xl flex-shrink-0 mt-0.5', iconClass)}>
          <Icon className="w-[18px] h-[18px]" />
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
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Overall Progress
            </p>
            {actionRequired > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-full px-2.5 py-0.5">
                <Zap className="w-3 h-3" />
                {actionRequired} need attention
              </span>
            )}
          </div>
          <span className="text-xl font-bold text-slate-900 tabular-nums">{completionRate}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-slate-400">
            {props.updated.toLocaleString()} of {props.total.toLocaleString()} requests completed
          </span>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {(props.total - props.updated).toLocaleString()} remaining
          </span>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Total Requests"
          value={props.total}
          icon={FileText}
          iconClass="bg-slate-100 text-slate-600"
          description="All time"
        />
        <KpiCard
          label="High Priority"
          value={props.highPrio}
          icon={AlertTriangle}
          iconClass="bg-rose-100 text-rose-600"
          cardClass="bg-rose-50/50 border-rose-200"
          accentClass="bg-rose-500"
          description="Immediate action"
        />
        <KpiCard
          label="Check Remarks"
          value={props.checkRemarks}
          icon={MessageSquare}
          iconClass="bg-amber-100 text-amber-600"
          cardClass="bg-amber-50/50 border-amber-200"
          accentClass="bg-amber-500"
          description="Pending review"
        />
        <KpiCard
          label="OSC Updated"
          value={props.updated}
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-600"
          description="Completed"
        />
        <KpiCard
          label="On Hold"
          value={props.onHold}
          icon={Clock}
          iconClass="bg-slate-100 text-slate-500"
          description="Awaiting action"
        />
        <KpiCard
          label="Email Sent"
          value={props.emailSent}
          icon={Mail}
          iconClass="bg-violet-100 text-violet-600"
          description="Includes reminders"
        />
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="New This Week"
          value={props.weeklyCount}
          unit="requests"
          icon={TrendingUp}
          iconClass="bg-blue-100 text-blue-600"
          description="Received in the last 7 days"
        />
        <MetricCard
          label="Avg OSC Processing"
          value={props.avgOscDays}
          unit="days"
          icon={Timer}
          iconClass="bg-cyan-100 text-cyan-600"
          description="From OSC request to updated"
          warn={props.avgOscDays > 14}
        />
        <MetricCard
          label="Avg Mail Response"
          value={props.avgMailDays}
          unit="days"
          icon={CalendarDays}
          iconClass="bg-teal-100 text-teal-600"
          description="From received to mail sent"
          warn={props.avgMailDays > 7}
        />
      </div>
    </div>
  )
}
