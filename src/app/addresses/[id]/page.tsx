import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { Pencil, ChevronRight } from 'lucide-react'
import { Role } from '@prisma/client'
import { can } from '@/lib/permissions'
import { addressLabel } from '@/lib/addresses'
import {
  formatDate, formatDateTime, formatAddressAuditValue,
  ADDRESS_ACTION_LABELS, ADDRESS_ACTION_LOZENGE,
} from '@/lib/utils'
import { Lozenge } from '@/components/ui/lozenge'
import { AuditTimeline } from '@/components/shared/audit-timeline'
import { DeleteRecordButton } from '@/components/shared/delete-record-button'
import { ADDRESS_REQUEST_FIELD_LABELS } from '@/lib/audit'

export default async function AddressDetailPage({ params }: { params: { id: string } }) {
  noStore()
  const session = await getSession()
  if (!session) redirect('/login')

  const role = session.user.role as Role
  const canEdit = can(role, 'address:write')
  const canDelete = can(role, 'address:delete')

  const [record, history] = await Promise.all([
    prisma.addressRequest.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { name: true } },
        reportedBy: { select: { name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { entity: 'ADDRESS_REQUEST', entityId: params.id },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { changedAt: 'asc' },
    }),
  ])

  if (!record) notFound()

  const label = addressLabel(record)

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <Link href="/addresses" className="hover:text-blue-600 hover:underline">Addresses</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">{label}</span>
      </nav>

      <div className="flex gap-4 items-start flex-col lg:flex-row">
        {/* Left: main content */}
        <div className="flex-1 min-w-0 space-y-4 w-full">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 leading-tight break-all">{label}</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {record.reporter ? `Reported by ${record.reporter}` : 'No reporter recorded'}
              </p>
            </div>
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {canEdit && (
                  <Link href={`/addresses/${record.id}/edit`} className="jira-btn-secondary text-xs">
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Link>
                )}
                {canDelete && (
                  <DeleteRecordButton
                    endpoint={`/api/addresses/${record.id}`}
                    redirectTo="/addresses"
                    subject={label}
                    confirmLabel="Delete this address request?"
                  />
                )}
              </div>
            )}
          </div>

          <div className="jira-panel p-4">
            <p className="jira-section-header">Notes</p>
            {record.notes ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{record.notes}</p>
            ) : (
              <p className="text-sm text-slate-400 italic mt-1">No notes recorded.</p>
            )}
          </div>

          <AuditTimeline
            entries={history}
            fieldLabels={ADDRESS_REQUEST_FIELD_LABELS}
            formatValue={formatAddressAuditValue}
            subjectNoun="address request"
          />
        </div>

        {/* Right: metadata */}
        <div className="w-full lg:w-60 flex-shrink-0">
          <div className="jira-panel divide-y divide-slate-50">
            <SidebarField label="Action">
              <Lozenge color={ADDRESS_ACTION_LOZENGE[record.action]}>
                {ADDRESS_ACTION_LABELS[record.action]}
              </Lozenge>
            </SidebarField>
            <SidebarField label="Request Date">
              <span className="text-sm text-slate-800 tabular-nums">{formatDate(record.requestDate)}</span>
            </SidebarField>
            <SidebarField label="Date of Completion">
              <span className="text-sm text-slate-800 tabular-nums">{formatDate(record.completionDate)}</span>
            </SidebarField>
            <SidebarField label="Reporter">
              <span className="text-sm text-slate-800">{record.reporter ?? '—'}</span>
              {record.reportedBy && (
                <span className="block text-[11px] text-slate-400">{record.reportedBy.name}</span>
              )}
            </SidebarField>
            <SidebarField label="POP Name">
              <span className="text-sm text-slate-800 font-mono break-all">
                {record.popName ?? '—'}
              </span>
            </SidebarField>
            <SidebarField label="Tina UUID">
              <span className="text-sm text-slate-800 font-mono text-xs break-all">
                {record.tinaUuid ?? '—'}
              </span>
            </SidebarField>
            <SidebarField label="AAP ID">
              <span className="text-sm text-slate-800 font-mono text-xs break-all">
                {record.aapId ?? '—'}
              </span>
            </SidebarField>
            <SidebarField label="Created By">
              <span className="text-sm text-slate-800">{record.createdBy.name}</span>
              <span className="block text-[11px] text-slate-400">{formatDateTime(record.createdAt)}</span>
            </SidebarField>
            <SidebarField label="Last Updated">
              <span className="text-sm text-slate-800 tabular-nums">{formatDateTime(record.updatedAt)}</span>
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
