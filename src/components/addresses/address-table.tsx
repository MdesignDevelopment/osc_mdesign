'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { AddressAction } from '@prisma/client'
import { ArrowUpRight, AlertCircle } from 'lucide-react'
import {
  formatDate,
  ADDRESS_ACTION_LABELS, ADDRESS_ACTION_LOZENGE, ADDRESS_ACTION_ORDER,
} from '@/lib/utils'
import { Lozenge } from '@/components/ui/lozenge'
import { SortableTh, LiveRegion } from '@/components/shared/table'
import { PlainTh, Pagination } from '@/components/shared/table-parts'
import {
  EditableCell, DraftCell, DraftActions, AddRowBar,
  DRAFT_ROW, focusRowStart, type CellOption,
} from '@/components/shared/editable-cell'

export interface AddressRow {
  id: string
  requestDate: string
  reporter: string | null
  popName: string | null
  tinaUuid: string | null
  aapId: string | null
  action: AddressAction
  completionDate: string | null
  updatedAt: string
  createdByName: string
}

type EditableField = {
  requestDate?: string
  reporter?: string | null
  popName?: string | null
  tinaUuid?: string | null
  aapId?: string | null
  action?: AddressAction
  completionDate?: string | null
}

const FIELD_LABELS: Record<string, string> = {
  requestDate: 'Request date',
  reporter: 'Reporter',
  popName: 'POP name',
  tinaUuid: 'Tina UUID',
  aapId: 'AAP ID',
  action: 'Action',
  completionDate: 'Completion date',
}

const ACTION_OPTIONS: CellOption[] = ADDRESS_ACTION_ORDER.map((a) => ({
  value: a,
  label: ADDRESS_ACTION_LABELS[a],
}))

const GRID = 'addresses'
const COL = {
  requestDate: 0, reporter: 1, popName: 2, tinaUuid: 3, aapId: 4, action: 5, completionDate: 6,
} as const
const COLUMN_COUNT = 8

/** Date-only fields are stored at UTC midnight, so the ISO date part is exact. */
function dateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Screen-reader subject for a row. Reporter used to fill this role, but it is
 * optional now, so identity falls back through the fields that actually name a
 * request. Mirrors `addressLabel` on the server.
 */
function rowLabel(v: { tinaUuid: string | null; aapId: string | null; popName: string | null; reporter: string | null }): string {
  return v.tinaUuid?.trim() || v.aapId?.trim() || v.popName?.trim() || v.reporter?.trim() || 'this request'
}

interface DraftState {
  requestDate: string
  reporter: string
  popName: string
  tinaUuid: string
  aapId: string
  action: AddressAction
  completionDate: string
}

function emptyDraft(): DraftState {
  return {
    requestDate: today(),
    reporter: '',
    popName: '',
    tinaUuid: '',
    aapId: '',
    action: 'OFF_HOLD',
    completionDate: '',
  }
}

interface Props {
  requests: AddressRow[]
  canWrite: boolean
  canDelete: boolean
  sort?: string
  dir?: string
  page: number
  totalPages: number
  total: number
  searchParams: Record<string, string | undefined>
}

export function AddressTable({
  requests, canWrite, sort, dir, page, totalPages, total, searchParams,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  // Client-known truth per row: consecutive cell edits in one row must not race
  // the router refresh, which would otherwise send a stale expectedUpdatedAt.
  const [overrides, setOverrides] = useState<Record<string, EditableField>>({})
  const [versions, setVersions] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [announcement, setAnnouncement] = useState<string | null>(null)

  const [draft, setDraft] = useState<DraftState | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftSaving, setDraftSaving] = useState(false)

  const currentSort = sort ?? 'action'
  const currentDir = dir ?? 'asc'

  const buildHref = useCallback(
    (o: Record<string, string | undefined>) => {
      const params = new URLSearchParams()
      Object.entries({ ...searchParams, ...o }).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return `${pathname}${qs ? `?${qs}` : ''}`
    },
    [pathname, searchParams],
  )

  const handleSort = (key: string) => {
    const nextDir = currentSort === key && currentDir === 'asc' ? 'desc' : 'asc'
    startTransition(() => router.push(buildHref({ sort: key, dir: nextDir, page: undefined })))
  }

  function valuesOf(row: AddressRow) {
    const o = overrides[row.id] ?? {}
    return {
      requestDate: o.requestDate ?? row.requestDate,
      reporter: o.reporter !== undefined ? o.reporter : row.reporter,
      popName: o.popName !== undefined ? o.popName : row.popName,
      tinaUuid: o.tinaUuid !== undefined ? o.tinaUuid : row.tinaUuid,
      aapId: o.aapId !== undefined ? o.aapId : row.aapId,
      action: o.action ?? row.action,
      completionDate: o.completionDate !== undefined ? o.completionDate : row.completionDate,
    }
  }

  async function patch(row: AddressRow, changes: EditableField) {
    const optimistic = { ...changes }

    setOverrides((p) => ({ ...p, [row.id]: { ...p[row.id], ...optimistic } }))
    setSaving((s) => ({ ...s, [row.id]: true }))

    const revert = () =>
      setOverrides((p) => {
        const forRow = { ...p[row.id] }
        // Roll back only what this call set; earlier confirmed edits stand.
        Object.keys(optimistic).forEach((k) => delete forRow[k as keyof EditableField])
        return { ...p, [row.id]: forRow }
      })

    try {
      const res = await fetch(`/api/addresses/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...changes, expectedUpdatedAt: versions[row.id] ?? row.updatedAt }),
      })

      if (!res.ok) {
        revert()
        const body = await res.json().catch(() => ({}))
        setAnnouncement(
          res.status === 409
            ? 'This request changed — refresh to see the latest.'
            : body?.error ?? 'Could not save the change.',
        )
        return
      }

      const saved = await res.json()
      if (saved?.updatedAt) setVersions((v) => ({ ...v, [row.id]: saved.updatedAt }))

      const fields = Object.keys(changes).map((k) => FIELD_LABELS[k] ?? k).join(', ')
      setAnnouncement(`${fields} saved for ${rowLabel(valuesOf(row))}.`)

      startTransition(() => router.refresh())
    } catch {
      revert()
      setAnnouncement('Could not reach the server. The change was not saved.')
    } finally {
      setSaving((s) => ({ ...s, [row.id]: false }))
    }
  }

  function openDraft() {
    setDraftError(null)
    setDraft(emptyDraft())
    requestAnimationFrame(() => focusRowStart(GRID, DRAFT_ROW))
  }

  function closeDraft() {
    setDraft(null)
    setDraftError(null)
  }

  async function saveDraft() {
    if (!draft || draftSaving) return

    // Mirrors addressRequestSchema so the row reports its own problems rather
    // than bouncing off the server for the obvious ones.
    const problem =
      !draft.requestDate ? 'A request date is required.'
      : !draft.tinaUuid.trim() && !draft.aapId.trim() ? 'Enter either a Tina UUID or an AAP ID.'
      : draft.completionDate && draft.completionDate < draft.requestDate
        ? 'The completion date cannot precede the request date.'
        : null

    if (problem) {
      setDraftError(problem)
      return
    }

    setDraftSaving(true)
    setDraftError(null)

    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestDate: draft.requestDate,
          reporter: draft.reporter.trim() || null,
          popName: draft.popName.trim() || null,
          tinaUuid: draft.tinaUuid.trim() || null,
          aapId: draft.aapId.trim() || null,
          action: draft.action,
          completionDate: draft.completionDate || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const first = body?.details?.fieldErrors
          ? Object.values(body.details.fieldErrors as Record<string, string[]>)[0]?.[0]
          : undefined
        setDraftError(body?.error && body.error !== 'Validation failed' ? body.error : first ?? 'Could not create the request.')
        return
      }

      const created = draft.tinaUuid.trim() || draft.aapId.trim()

      // Kept open and empty — the row exists so several requests can be logged
      // one after another without a form round-trip each time.
      setDraft(emptyDraft())
      setAnnouncement(`Address request ${created} created.`)
      requestAnimationFrame(() => focusRowStart(GRID, DRAFT_ROW))
      startTransition(() => router.refresh())
    } catch {
      setDraftError('Could not reach the server. The request was not created.')
    } finally {
      setDraftSaving(false)
    }
  }

  return (
    <>
      <LiveRegion message={announcement} />

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        {canWrite && (
          <AddRowBar
            // With a row already open the click puts the cursor back in it
            // rather than throwing away half-typed input.
            onClick={draft ? () => focusRowStart(GRID, DRAFT_ROW) : openDraft}
            label="Add request"
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <SortableTh label="Request Date" sortKey="requestDate" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                <SortableTh label="Reporter" sortKey="reporter" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                <SortableTh label="POP Name" sortKey="popName" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                <PlainTh label="Tina UUID" />
                <PlainTh label="AAP ID" />
                <SortableTh label="Action" sortKey="action" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                <SortableTh label="Completed" sortKey="completionDate" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                <PlainTh label="Open" srOnly className="w-10" />
              </tr>
            </thead>
            <tbody>
              {draft && (
                <>
                  <tr className="bg-blue-50/30 border-b border-blue-100">
                    <DraftCell
                      gridId={GRID}
                      col={COL.requestDate}
                      kind="date"
                      value={draft.requestDate}
                      ariaLabel="New request date"
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, requestDate: v })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                    />
                    <DraftCell
                      gridId={GRID}
                      col={COL.reporter}
                      value={draft.reporter}
                      ariaLabel="New request reporter"
                      placeholder="Who reported it"
                      maxLength={128}
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, reporter: v })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                    />
                    <DraftCell
                      gridId={GRID}
                      col={COL.popName}
                      value={draft.popName}
                      ariaLabel="New request POP name"
                      placeholder="POP name"
                      maxLength={128}
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, popName: v })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                      className="font-mono"
                    />
                    <DraftCell
                      gridId={GRID}
                      col={COL.tinaUuid}
                      value={draft.tinaUuid}
                      ariaLabel="New request Tina UUID"
                      placeholder="Tina UUID"
                      maxLength={64}
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, tinaUuid: v })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                      className="font-mono"
                    />
                    <DraftCell
                      gridId={GRID}
                      col={COL.aapId}
                      value={draft.aapId}
                      ariaLabel="New request AAP ID"
                      placeholder="or AAP ID"
                      maxLength={64}
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, aapId: v })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                      className="font-mono"
                    />
                    <DraftCell
                      gridId={GRID}
                      col={COL.action}
                      kind="select"
                      options={ACTION_OPTIONS}
                      value={draft.action}
                      ariaLabel="New request action"
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, action: v as AddressAction })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                    />
                    <DraftCell
                      gridId={GRID}
                      col={COL.completionDate}
                      kind="date"
                      value={draft.completionDate}
                      ariaLabel="New request completion date"
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, completionDate: v })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                    />
                    <DraftActions onSave={saveDraft} onCancel={closeDraft} saving={draftSaving} />
                  </tr>
                  {draftError && (
                    <tr className="bg-red-50/60 border-b border-red-100">
                      <td colSpan={COLUMN_COUNT} className="px-4 py-2">
                        <p className="flex items-center gap-1.5 text-xs text-red-600">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {draftError}
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              )}

              {requests.length === 0 && !draft && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-4 py-14 text-center">
                    <p className="text-sm font-medium text-neutral-500">No address requests found</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Try adjusting your filters{canWrite ? ', or use + Add request above' : ''}
                    </p>
                  </td>
                </tr>
              )}

              {requests.map((row, rowIndex) => {
                const values = valuesOf(row)
                const busy = saving[row.id]
                const label = rowLabel(values)

                return (
                  <tr key={row.id} className="jira-table-row">
                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.requestDate}
                      kind="date"
                      value={dateInput(values.requestDate)}
                      editable={canWrite}
                      saving={busy}
                      ariaLabel={`Request date — ${label}`}
                      display={formatDate(values.requestDate)}
                      className="tabular-nums whitespace-nowrap"
                      onCommit={(v) => patch(row, { requestDate: v })}
                    />

                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.reporter}
                      value={values.reporter ?? ''}
                      editable={canWrite}
                      maxLength={128}
                      saving={busy}
                      ariaLabel={`Reporter — ${label}`}
                      display={values.reporter ? <span className="font-medium">{values.reporter}</span> : undefined}
                      onCommit={(v) => patch(row, { reporter: v || null })}
                    />

                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.popName}
                      value={values.popName ?? ''}
                      editable={canWrite}
                      maxLength={128}
                      saving={busy}
                      ariaLabel={`POP name — ${label}`}
                      className="font-mono text-xs text-neutral-600"
                      onCommit={(v) => patch(row, { popName: v || null })}
                    />

                    {/* Two columns rather than one merged identifier cell: the
                        two are different namespaces (spec A2), and each has to
                        be separately editable. */}
                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.tinaUuid}
                      value={values.tinaUuid ?? ''}
                      editable={canWrite}
                      maxLength={64}
                      saving={busy}
                      ariaLabel={`Tina UUID — ${label}`}
                      className="font-mono text-xs text-neutral-600"
                      onCommit={(v) => patch(row, { tinaUuid: v || null })}
                    />

                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.aapId}
                      value={values.aapId ?? ''}
                      editable={canWrite}
                      maxLength={64}
                      saving={busy}
                      ariaLabel={`AAP ID — ${label}`}
                      className="font-mono text-xs text-neutral-600"
                      onCommit={(v) => patch(row, { aapId: v || null })}
                    />

                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.action}
                      kind="select"
                      options={ACTION_OPTIONS}
                      value={values.action}
                      editable={canWrite}
                      saving={busy}
                      ariaLabel={`Action — ${label}`}
                      display={
                        <Lozenge color={ADDRESS_ACTION_LOZENGE[values.action]}>
                          {ADDRESS_ACTION_LABELS[values.action]}
                        </Lozenge>
                      }
                      onCommit={(v) => patch(row, { action: v as AddressAction })}
                    />

                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.completionDate}
                      kind="date"
                      value={dateInput(values.completionDate)}
                      editable={canWrite}
                      saving={busy}
                      ariaLabel={`Completion date — ${label}`}
                      display={values.completionDate ? formatDate(values.completionDate) : undefined}
                      className="tabular-nums whitespace-nowrap text-neutral-500"
                      onCommit={(v) => patch(row, { completionDate: v || null })}
                    />

                    <td className="jira-table-cell">
                      <Link
                        href={`/addresses/${row.id}`}
                        aria-label={`Open request ${label}`}
                        title="Open request"
                        className="inline-flex p-1 rounded text-neutral-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        buildHref={(p) => buildHref({ page: p > 1 ? String(p) : undefined })}
      />
    </>
  )
}
