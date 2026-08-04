import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { Pencil, ChevronRight } from 'lucide-react'
import { Role } from '@prisma/client'
import { can } from '@/lib/permissions'
import { projectOscStatus } from '@/lib/osc-status-lookup'
import {
  formatDateTime,
  DESIGN_STAGE_LABELS, DESIGN_STAGE_LOZENGE, STATUS_LABELS,
} from '@/lib/utils'
import { Lozenge } from '@/components/ui/lozenge'
import { AuditTimeline } from '@/components/shared/audit-timeline'
import { DeleteRecordButton } from '@/components/shared/delete-record-button'
import { ScriptsPanel } from '@/components/design-sessions/scripts-panel'
import { OscStatusCell } from '@/components/design-sessions/osc-status-cell'
import { DESIGN_SESSION_FIELD_LABELS } from '@/lib/audit'

const SCRIPT_LIMIT = 50

function formatAuditValue(field: string | null, value: string): string {
  // Booleans are stored as Yes/No by the audit layer, so they need no mapping.
  if (field === 'oscStatus') {
    return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value
  }
  return value
}

export default async function DesignSessionDetailPage({ params }: { params: { id: string } }) {
  // The OSC Status projection must always be live.
  noStore()

  const session = await getSession()
  if (!session) redirect('/login')

  const role = session.user.role as Role
  const canEdit = can(role, 'design:write')
  const canDelete = can(role, 'design:delete')
  const canReadOsc = can(role, 'osc:read')

  const record = await prisma.designSession.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      scripts: {
        orderBy: { executedAt: 'desc' },
        take: SCRIPT_LIMIT + 1,
        include: { executedBy: { select: { name: true } } },
      },
    },
  })

  if (!record) notFound()

  const [history, oscStatus] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entity: 'DESIGN_SESSION', entityId: params.id },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { changedAt: 'asc' },
    }),
    projectOscStatus(record.popZoneKey),
  ])

  const truncated = record.scripts.length > SCRIPT_LIMIT
  const scripts = truncated ? record.scripts.slice(0, SCRIPT_LIMIT) : record.scripts
  const stage = record.stage

  const flagRows = [
    { label: 'Send OC Request to Partner', value: record.sendOcRequestToPartner },
    { label: 'AAP on Hold', value: record.aapOnHold },
    { label: 'Ready to Post', value: record.readyToPost },
    { label: 'Posted', value: record.posted },
  ]

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <Link href="/design-sessions" className="hover:text-blue-600 hover:underline">Design Sessions</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium font-mono">{record.popZone}</span>
      </nav>

      <div className="flex gap-4 items-start flex-col lg:flex-row">
        {/* Left: main content */}
        <div className="flex-1 min-w-0 space-y-4 w-full">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 leading-tight font-mono break-all">
                {record.popZone}
              </h1>
              {record.cabinetName && (
                <p className="text-sm text-slate-400 mt-0.5 font-mono">{record.cabinetName}</p>
              )}
            </div>
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {canEdit && (
                  <Link href={`/design-sessions/${record.id}/edit`} className="jira-btn-secondary text-xs">
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Link>
                )}
                {canDelete && (
                  <DeleteRecordButton
                    endpoint={`/api/design-sessions/${record.id}`}
                    redirectTo="/design-sessions"
                    subject={record.popZone}
                    confirmLabel="Delete this design session?"
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

          <div className="jira-panel p-4">
            <p className="jira-section-header">Actions Done</p>
            {record.actionsDone ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{record.actionsDone}</p>
            ) : (
              <p className="text-sm text-slate-400 italic mt-1">No actions recorded yet.</p>
            )}
          </div>

          <ScriptsPanel
            popZone={record.popZone}
            truncated={truncated}
            scripts={scripts.map((s) => ({
              id: s.id,
              scriptName: s.scriptName,
              scriptVersion: s.scriptVersion,
              status: s.status,
              executedAt: s.executedAt.toISOString(),
              durationMs: s.durationMs,
              output: s.output,
              executedByLabel: s.executedByLabel,
              executedByName: s.executedBy?.name ?? null,
            }))}
          />

          <AuditTimeline
            entries={history}
            fieldLabels={DESIGN_SESSION_FIELD_LABELS}
            formatValue={formatAuditValue}
            subjectNoun="design session"
          />
        </div>

        {/* Right: metadata */}
        <div className="w-full lg:w-60 flex-shrink-0">
          <div className="jira-panel divide-y divide-slate-50">
            <SidebarField label="OSC Status">
              <OscStatusCell
                value={oscStatus}
                popZone={record.popZone}
                canReadOsc={canReadOsc}
              />
            </SidebarField>
            <SidebarField label="Stage">
              <Lozenge color={DESIGN_STAGE_LOZENGE[stage]}>
                {DESIGN_STAGE_LABELS[stage]}
              </Lozenge>
            </SidebarField>
            <SidebarField label="Cabinet Name">
              <span className="text-sm text-slate-800 font-mono text-xs break-all">
                {record.cabinetName ?? '—'}
              </span>
            </SidebarField>
            <SidebarField label="MRO Partner">
              <span className="text-sm text-slate-800">{record.mroPartner ?? '—'}</span>
            </SidebarField>

            <div className="px-4 py-3 space-y-1.5">
              <p className="text-xs font-medium text-slate-400 mb-1.5">Progress</p>
              {flagRows.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] text-slate-600">{f.label}</span>
                  <span
                    className={
                      f.value
                        ? 'text-[11px] font-semibold text-emerald-600'
                        : 'text-[11px] text-slate-300'
                    }
                  >
                    {f.value ? 'Yes' : 'No'}
                  </span>
                </div>
              ))}
            </div>

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
