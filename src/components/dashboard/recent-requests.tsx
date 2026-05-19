import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { StatusLozenge, PriorityLozenge } from '@/components/ui/lozenge'
import { OscRequest, Partner, OscStatus, Priority } from '@prisma/client'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

type RecentRequest = OscRequest & { partner: Partner; createdBy: { name: string } }

export function RecentRequests({ requests }: { requests: RecentRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-14 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-50 mb-3">
          <Inbox className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">No requests found</p>
        <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Table header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <p className="text-xs font-semibold text-slate-600">
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </p>
        <p className="text-[11px] text-slate-400">Sorted by most recent</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="jira-table-header pl-5">Pop Zone</th>
              <th className="jira-table-header">Partner</th>
              <th className="jira-table-header">Status</th>
              <th className="jira-table-header">Priority</th>
              <th className="jira-table-header">Received</th>
              <th className="jira-table-header">OSC Request</th>
              <th className="jira-table-header pr-5">Mail Sent</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => {
              const isHighPrio = req.priority === 'HIGH_PRIO'
              return (
                <tr
                  key={req.id}
                  className={cn(
                    'border-b border-slate-50 transition-colors',
                    isHighPrio
                      ? 'bg-rose-50/30 hover:bg-rose-50/60'
                      : 'hover:bg-slate-50/60',
                  )}
                >
                  <td className="jira-table-cell whitespace-nowrap pl-5">
                    {isHighPrio && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 mr-2 align-middle mb-0.5" />
                    )}
                    <Link
                      href={`/osc/${req.id}`}
                      className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                    >
                      {req.popzone}
                    </Link>
                  </td>
                  <td className="jira-table-cell text-slate-600 whitespace-nowrap">
                    {req.partner.name}
                  </td>
                  <td className="jira-table-cell whitespace-nowrap">
                    <StatusLozenge status={req.status as OscStatus} />
                  </td>
                  <td className="jira-table-cell whitespace-nowrap">
                    <PriorityLozenge priority={req.priority as Priority} />
                  </td>
                  <td className="jira-table-cell text-slate-500 whitespace-nowrap tabular-nums text-xs">
                    {formatDate(req.receivedDate)}
                  </td>
                  <td className="jira-table-cell text-slate-500 whitespace-nowrap tabular-nums text-xs">
                    {formatDate(req.oscRequestDate)}
                  </td>
                  <td className="jira-table-cell text-slate-500 whitespace-nowrap tabular-nums text-xs pr-5">
                    {formatDate(req.mailSentDate)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
