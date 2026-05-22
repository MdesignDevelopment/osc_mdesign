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
      <div className="bg-white dark:bg-[#111] rounded-lg border border-neutral-200 dark:border-white/8 p-14 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100 dark:bg-white/5 mb-3">
          <Inbox className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
        </div>
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">No requests found</p>
        <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#111] rounded-lg border border-neutral-200 dark:border-white/8 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-100 dark:border-white/5">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </p>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-600">Most recent first</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-white/5">
              <th className="jira-table-header pl-5">Pop Zone</th>
              <th className="jira-table-header">Partner</th>
              <th className="jira-table-header">Status</th>
              <th className="jira-table-header">Priority</th>
              <th className="jira-table-header">OSC Request</th>
              <th className="jira-table-header">Mail Sent</th>
              <th className="jira-table-header pr-5">Received</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => {
              const isHighPrio = req.priority === 'HIGH_PRIO'
              return (
                <tr
                  key={req.id}
                  className={cn(
                    'border-b border-neutral-50 dark:border-white/[0.04] transition-colors',
                    isHighPrio
                      ? 'bg-rose-50/40 dark:bg-rose-950/10 hover:bg-rose-50/70 dark:hover:bg-rose-950/20'
                      : 'hover:bg-neutral-50/80 dark:hover:bg-white/[0.03]',
                  )}
                >
                  <td className="jira-table-cell whitespace-nowrap pl-5">
                    {isHighPrio && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 mr-2 align-middle mb-0.5" />
                    )}
                    <Link
                      href={`/osc/${req.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline"
                    >
                      {req.popzone}
                    </Link>
                  </td>
                  <td className="jira-table-cell text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                    {req.partner.name}
                  </td>
                  <td className="jira-table-cell whitespace-nowrap">
                    <StatusLozenge status={req.status as OscStatus} />
                  </td>
                  <td className="jira-table-cell whitespace-nowrap">
                    <PriorityLozenge priority={req.priority as Priority} />
                  </td>
                  <td className="jira-table-cell text-neutral-400 dark:text-neutral-500 whitespace-nowrap tabular-nums text-xs">
                    {formatDate(req.oscRequestDate)}
                  </td>
                  <td className="jira-table-cell text-neutral-400 dark:text-neutral-500 whitespace-nowrap tabular-nums text-xs">
                    {formatDate(req.mailSentDate)}
                  </td>
                  <td className="jira-table-cell text-neutral-400 dark:text-neutral-500 whitespace-nowrap tabular-nums text-xs pr-5">
                    {formatDate(req.receivedDate)}
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
