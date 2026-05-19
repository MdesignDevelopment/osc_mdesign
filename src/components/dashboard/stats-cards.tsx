import { CheckCircle2, Clock, AlertTriangle, Mail, MessageSquare, FileText } from 'lucide-react'

interface StatsCardsProps {
  total: number
  updated: number
  onHold: number
  highPrio: number
  emailSent: number
  checkRemarks: number
}

function StatCard({ label, value, icon: Icon }: {
  label: string; value: number; icon: React.ElementType
}) {
  return (
    <div className="jira-panel p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">
          {value.toLocaleString()}
        </p>
      </div>
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  )
}

export function StatsCards(props: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="Total" value={props.total} icon={FileText} />
      <StatCard label="OSC Updated" value={props.updated} icon={CheckCircle2} />
      <StatCard label="On Hold" value={props.onHold} icon={Clock} />
      <StatCard label="High Priority" value={props.highPrio} icon={AlertTriangle} />
      <StatCard label="Email Sent" value={props.emailSent} icon={Mail} />
      <StatCard label="Check Remarks" value={props.checkRemarks} icon={MessageSquare} />
    </div>
  )
}
