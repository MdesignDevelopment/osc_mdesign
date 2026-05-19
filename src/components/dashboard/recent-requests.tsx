import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { StatusLozenge, PriorityLozenge } from '@/components/ui/lozenge'
import { OscRequest, Partner, OscStatus, Priority } from '@prisma/client'

type RecentRequest = OscRequest & { partner: Partner; createdBy: { name: string } }

export function RecentRequests({ requests }: { requests: RecentRequest[] }) {
  return (
    <div className="jira-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <p className="jira-section-header mb-0">Recent OSC Requests</p>
        <Link href="/osc" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          View all →
        </Link>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="jira-table-header">PopZone</th>
            <th className="jira-table-header">Partner</th>
            <th className="jira-table-header">Status</th>
            <th className="jira-table-header">Priority</th>
            <th className="jira-table-header">Received</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} className="jira-table-row">
              <td className="jira-table-cell">
                <Link href={`/osc/${req.id}`} className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                  {req.popzone}
                </Link>
              </td>
              <td className="jira-table-cell text-slate-600">{req.partner.name}</td>
              <td className="jira-table-cell">
                <StatusLozenge status={req.status as OscStatus} />
              </td>
              <td className="jira-table-cell">
                <PriorityLozenge priority={req.priority as Priority} />
              </td>
              <td className="jira-table-cell text-slate-500">{formatDate(req.receivedDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
