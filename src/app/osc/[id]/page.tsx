import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { OscTimeline } from '@/components/osc/osc-timeline'
import Link from 'next/link'
import { Pencil, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { StatusLozenge, PriorityLozenge } from '@/components/ui/lozenge'
import { OscStatus, Priority } from '@prisma/client'

export default async function OscDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const request = await prisma.oscRequest.findUnique({
    where: { id: params.id },
    include: {
      partner: true,
      createdBy: { select: { name: true, email: true } },
      comments: {
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      history: {
        include: { user: { select: { name: true } } },
        orderBy: { changedAt: 'asc' },
      },
    },
  })

  if (!request) notFound()

  const canEdit = session.user.role === 'ADMIN' || session.user.role === 'SUPPORT_ENGINEER'

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <Link href="/osc" className="hover:text-blue-600 hover:underline">OSC Requests</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">{request.popzone}</span>
      </nav>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start">
        {/* Left: main content */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">{request.popzone}</h1>
            {canEdit && (
              <Link href={`/osc/${params.id}/edit`} className="jira-btn-secondary flex-shrink-0 text-xs">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Link>
            )}
          </div>

          <div className="jira-panel p-4">
            <p className="jira-section-header">Description</p>
            {request.remark ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{request.remark}</p>
            ) : (
              <p className="text-sm text-slate-400 italic mt-1">No description provided.</p>
            )}
          </div>

          <OscTimeline
            oscId={request.id}
            comments={request.comments}
            history={request.history}
            currentUser={{ id: session.user.id, role: session.user.role }}
            canComment={true}
          />
        </div>

        {/* Right: metadata sidebar */}
        <div className="w-60 flex-shrink-0">
          <div className="jira-panel divide-y divide-slate-50">
            <SidebarField label="Status">
              <StatusLozenge status={request.status as OscStatus} />
            </SidebarField>
            <SidebarField label="Priority">
              <PriorityLozenge priority={request.priority as Priority} />
            </SidebarField>
            <SidebarField label="Partner">
              <span className="text-sm text-slate-800">{request.partner.name}</span>
            </SidebarField>
            <SidebarField label="Received">
              <span className="text-sm text-slate-800">{formatDate(request.receivedDate)}</span>
            </SidebarField>
            <SidebarField label="OSC Request">
              <span className="text-sm text-slate-800">{formatDate(request.oscRequestDate)}</span>
            </SidebarField>
            <SidebarField label="Mail Sent">
              <span className="text-sm text-slate-800">{formatDate(request.mailSentDate)}</span>
            </SidebarField>
            <SidebarField label="Updated">
              <span className="text-sm text-slate-800">{formatDate(request.updatedDate)}</span>
            </SidebarField>
            <SidebarField label="Created By">
              <span className="text-sm text-slate-800">{request.createdBy.name}</span>
            </SidebarField>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      {children}
    </div>
  )
}
