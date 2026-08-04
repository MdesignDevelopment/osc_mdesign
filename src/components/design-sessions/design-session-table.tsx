'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { DesignStage } from '@prisma/client'
import { ArrowUpRight, AlertCircle } from 'lucide-react'
import {
  formatDate,
  DESIGN_STAGE_LABELS, DESIGN_STAGE_LOZENGE, DESIGN_STAGE_ORDER,
} from '@/lib/utils'
import { Lozenge } from '@/components/ui/lozenge'
import { SortableTh, LiveRegion } from '@/components/shared/table'
import { PlainTh, Pagination, BooleanCell } from '@/components/shared/table-parts'
import {
  EditableCell, EditableCheckboxCell, DraftCell, DraftActions, AddRowBar,
  DRAFT_ROW, focusRowStart, type CellOption,
} from '@/components/shared/editable-cell'
import { OscStatusCell, type OscStatusValue } from './osc-status-cell'

export interface DesignSessionRow {
  id: string
  popZone: string
  popZoneKey: string
  cabinetName: string | null
  mroPartner: string | null
  stage: DesignStage
  sendOcRequestToPartner: boolean
  aapOnHold: boolean
  readyToPost: boolean
  posted: boolean
  updatedAt: string
  oscStatus: OscStatusValue | null
}

type FlagKey = 'sendOcRequestToPartner' | 'aapOnHold' | 'readyToPost' | 'posted'
type TextKey = 'cabinetName' | 'mroPartner'
type EditableField = Partial<
  Record<FlagKey, boolean> & Record<TextKey, string | null> & { stage: DesignStage }
>

const FLAG_COLUMNS: { key: FlagKey; short: string; label: string }[] = [
  { key: 'sendOcRequestToPartner', short: 'OC Req', label: 'Send OC Request to Partner' },
  { key: 'aapOnHold', short: 'AAP Hold', label: 'AAP on Hold' },
  { key: 'readyToPost', short: 'Ready', label: 'Ready to Post' },
  { key: 'posted', short: 'Posted', label: 'Posted' },
]

const FIELD_LABELS: Record<string, string> = {
  cabinetName: 'Cabinet',
  mroPartner: 'MRO Partner',
  stage: 'Stage',
  ...Object.fromEntries(FLAG_COLUMNS.map((f) => [f.key, f.label])),
}

const STAGE_OPTIONS: CellOption[] = DESIGN_STAGE_ORDER.map((s) => ({
  value: s,
  label: DESIGN_STAGE_LABELS[s],
}))

// Grid coordinates. POP Zone is column 0 but only the draft row registers it:
// it is immutable once saved (spec §6.1), so existing rows have nothing there.
// Column 3 is OSC Status, which is projected and never editable.
const GRID = 'design-sessions'
const COL = {
  popZone: 0, cabinetName: 1, mroPartner: 2, stage: 4,
  flags: 5, // + index within FLAG_COLUMNS
} as const
const COLUMN_COUNT = 11

interface DraftState {
  popZone: string
  cabinetName: string
  mroPartner: string
  stage: DesignStage
  sendOcRequestToPartner: boolean
  aapOnHold: boolean
  readyToPost: boolean
  posted: boolean
}

const EMPTY_DRAFT: DraftState = {
  popZone: '', cabinetName: '', mroPartner: '', stage: 'IN_SESSION',
  sendOcRequestToPartner: false, aapOnHold: false, readyToPost: false, posted: false,
}

interface Props {
  sessions: DesignSessionRow[]
  canWrite: boolean
  canReadOsc: boolean
  partners: string[]
  sort?: string
  dir?: string
  page: number
  totalPages: number
  total: number
  searchParams: Record<string, string | undefined>
}

export function DesignSessionTable({
  sessions, canWrite, canReadOsc, partners, sort, dir, page, totalPages, total, searchParams,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  // Client-known truth per row, so a second cell edit in the same row does not
  // race the router refresh that would otherwise still be carrying old values.
  const [overrides, setOverrides] = useState<Record<string, EditableField>>({})
  const [versions, setVersions] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [announcement, setAnnouncement] = useState<string | null>(null)

  const [draft, setDraft] = useState<DraftState | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftSaving, setDraftSaving] = useState(false)

  const currentSort = sort ?? 'stage'
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

  function valuesOf(row: DesignSessionRow) {
    const o = overrides[row.id] ?? {}
    return {
      cabinetName: o.cabinetName !== undefined ? o.cabinetName : row.cabinetName,
      mroPartner: o.mroPartner !== undefined ? o.mroPartner : row.mroPartner,
      stage: o.stage ?? row.stage,
      sendOcRequestToPartner: o.sendOcRequestToPartner ?? row.sendOcRequestToPartner,
      aapOnHold: o.aapOnHold ?? row.aapOnHold,
      readyToPost: o.readyToPost ?? row.readyToPost,
      posted: o.posted ?? row.posted,
    }
  }

  /** One partial write — a single cell or a single flag (spec §6.3). */
  async function patch(row: DesignSessionRow, changes: EditableField) {
    // Mirror the server's auto-set so the UI does not flicker afterwards.
    const optimistic: EditableField = { ...changes }
    if (changes.posted === true && !valuesOf(row).readyToPost) optimistic.readyToPost = true

    setOverrides((p) => ({ ...p, [row.id]: { ...p[row.id], ...optimistic } }))
    setBusy((b) => ({ ...b, [row.id]: true }))

    const revert = () =>
      setOverrides((p) => {
        const forRow = { ...p[row.id] }
        // Only the keys this call set are rolled back; earlier confirmed edits stay.
        Object.keys(optimistic).forEach((k) => delete forRow[k as keyof EditableField])
        return { ...p, [row.id]: forRow }
      })

    try {
      const res = await fetch(`/api/design-sessions/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...changes, expectedUpdatedAt: versions[row.id] ?? row.updatedAt }),
      })

      if (!res.ok) {
        revert()
        const body = await res.json().catch(() => ({}))
        setAnnouncement(
          res.status === 409
            ? 'This session changed — refresh to see the latest.'
            : body?.error ?? 'Could not save the change.',
        )
        return
      }

      const saved = await res.json()
      if (saved?.updatedAt) setVersions((v) => ({ ...v, [row.id]: saved.updatedAt }))

      const warnings: string[] = saved?.warnings ?? []
      const autoSet: string[] = saved?.autoSet ?? []
      const fields = Object.keys(changes).map((k) => FIELD_LABELS[k] ?? k).join(', ')

      setAnnouncement(
        [
          `${fields} saved for ${row.popZone}.`,
          autoSet.includes('readyToPost') ? 'Ready to Post was set automatically.' : null,
          ...warnings,
        ].filter(Boolean).join(' '),
      )

      startTransition(() => router.refresh())
    } catch {
      revert()
      setAnnouncement('Could not reach the server. The change was not saved.')
    } finally {
      setBusy((b) => ({ ...b, [row.id]: false }))
    }
  }

  function openDraft() {
    setDraftError(null)
    setDraft(EMPTY_DRAFT)
    // The row mounts this frame; focus its first cell on the next one.
    requestAnimationFrame(() => focusRowStart(GRID, DRAFT_ROW))
  }

  function closeDraft() {
    setDraft(null)
    setDraftError(null)
  }

  async function saveDraft() {
    if (!draft || draftSaving) return

    const popZone = draft.popZone.trim()
    if (popZone.length < 3) {
      setDraftError('POP Zone is required (at least 3 characters).')
      requestAnimationFrame(() => focusRowStart(GRID, DRAFT_ROW))
      return
    }

    setDraftSaving(true)
    setDraftError(null)

    try {
      const res = await fetch('/api/design-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          popZone,
          cabinetName: draft.cabinetName.trim() || null,
          mroPartner: draft.mroPartner.trim() || null,
          stage: draft.stage,
          sendOcRequestToPartner: draft.sendOcRequestToPartner,
          aapOnHold: draft.aapOnHold,
          readyToPost: draft.readyToPost,
          posted: draft.posted,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setDraftError(
          body?.error
          ?? body?.details?.fieldErrors?.popZone?.[0]
          ?? 'Could not create the session.',
        )
        return
      }

      // The row stays open and empty: the point of the inline row is entering
      // several sessions in a row without a form round-trip each time.
      setDraft(EMPTY_DRAFT)
      setAnnouncement(`Design session ${popZone} created.`)
      requestAnimationFrame(() => focusRowStart(GRID, DRAFT_ROW))
      startTransition(() => router.refresh())
    } catch {
      setDraftError('Could not reach the server. The session was not created.')
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
            label="Add session"
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <SortableTh label="POP Zone" sortKey="popZone" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                <SortableTh label="Cabinet" sortKey="cabinetName" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                <SortableTh label="MRO Partner" sortKey="mroPartner" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                <PlainTh label="OSC Status" />
                <SortableTh label="Stage" sortKey="stage" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                {FLAG_COLUMNS.map((f) => (
                  <PlainTh key={f.key} label={f.short} align="center" className="w-[72px]" />
                ))}
                <SortableTh label="Updated" sortKey="updatedAt" currentSort={currentSort} currentDir={currentDir} onSort={handleSort} />
                <PlainTh label="Open" srOnly className="w-10" />
              </tr>
            </thead>
            <tbody>
              {draft && (
                <>
                  <tr className="bg-blue-50/30 border-b border-blue-100">
                    <DraftCell
                      gridId={GRID}
                      col={COL.popZone}
                      value={draft.popZone}
                      ariaLabel="New session POP Zone"
                      placeholder="MRO_CITY_01_POP_001"
                      maxLength={64}
                      invalid={Boolean(draftError)}
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, popZone: v })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                      className="font-mono"
                    />
                    <DraftCell
                      gridId={GRID}
                      col={COL.cabinetName}
                      value={draft.cabinetName}
                      ariaLabel="New session cabinet name"
                      placeholder="Cabinet"
                      maxLength={64}
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, cabinetName: v })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                    />
                    <DraftCell
                      gridId={GRID}
                      col={COL.mroPartner}
                      value={draft.mroPartner}
                      ariaLabel="New session MRO partner"
                      placeholder={partners[0] ? `e.g. ${partners[0]}` : 'Partner'}
                      maxLength={64}
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, mroPartner: v })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                    />
                    {/* OSC Status is projected from the OSC tracker — not enterable. */}
                    <td className="jira-table-cell text-neutral-300 text-xs">—</td>
                    <DraftCell
                      gridId={GRID}
                      col={COL.stage}
                      kind="select"
                      options={STAGE_OPTIONS}
                      value={draft.stage}
                      ariaLabel="New session stage"
                      disabled={draftSaving}
                      onChange={(v) => setDraft({ ...draft, stage: v as DesignStage })}
                      onSave={saveDraft}
                      onCancel={closeDraft}
                    />
                    {FLAG_COLUMNS.map((f, i) => (
                      <EditableCheckboxCell
                        key={f.key}
                        gridId={GRID}
                        row={DRAFT_ROW}
                        col={COL.flags + i}
                        value={draft[f.key]}
                        ariaLabel={`New session — ${f.label}`}
                        saving={draftSaving}
                        onCommit={(v) => setDraft({ ...draft, [f.key]: v })}
                      />
                    ))}
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

              {sessions.length === 0 && !draft && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-4 py-14 text-center">
                    <p className="text-sm font-medium text-neutral-500">No design sessions found</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Try adjusting your filters{canWrite ? ', or use + Add session above' : ''}
                    </p>
                  </td>
                </tr>
              )}

              {sessions.map((row, rowIndex) => {
                const values = valuesOf(row)
                const rowBusy = busy[row.id]

                return (
                  <tr key={row.id} className="jira-table-row">
                    {/* POP Zone is the record identity, the OSC Status join key
                        and the script link key — read-only after creation. */}
                    <td className="jira-table-cell">
                      <Link
                        href={`/design-sessions/${row.id}`}
                        className="font-medium text-blue-600 hover:underline font-mono text-xs"
                      >
                        {row.popZone}
                      </Link>
                    </td>

                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.cabinetName}
                      value={values.cabinetName ?? ''}
                      editable={canWrite}
                      maxLength={64}
                      saving={rowBusy}
                      ariaLabel={`Cabinet — ${row.popZone}`}
                      display={values.cabinetName ?? undefined}
                      className="font-mono text-xs text-neutral-600"
                      onCommit={(v) => patch(row, { cabinetName: v || null })}
                    />

                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.mroPartner}
                      value={values.mroPartner ?? ''}
                      editable={canWrite}
                      maxLength={64}
                      saving={rowBusy}
                      ariaLabel={`MRO Partner — ${row.popZone}`}
                      display={values.mroPartner ?? undefined}
                      className="text-neutral-600"
                      onCommit={(v) => patch(row, { mroPartner: v || null })}
                    />

                    <td className="jira-table-cell">
                      <OscStatusCell
                        value={row.oscStatus}
                        popZone={row.popZone}
                        canReadOsc={canReadOsc}
                      />
                    </td>

                    <EditableCell
                      gridId={GRID}
                      row={rowIndex}
                      col={COL.stage}
                      kind="select"
                      options={STAGE_OPTIONS}
                      value={values.stage}
                      editable={canWrite}
                      saving={rowBusy}
                      ariaLabel={`Stage — ${row.popZone}`}
                      display={
                        <Lozenge color={DESIGN_STAGE_LOZENGE[values.stage]}>
                          {DESIGN_STAGE_LABELS[values.stage]}
                        </Lozenge>
                      }
                      onCommit={(v) => patch(row, { stage: v as DesignStage })}
                    />

                    {FLAG_COLUMNS.map((f, i) => (
                      canWrite ? (
                        <EditableCheckboxCell
                          key={f.key}
                          gridId={GRID}
                          row={rowIndex}
                          col={COL.flags + i}
                          value={values[f.key]}
                          saving={rowBusy}
                          ariaLabel={`${f.label} — ${row.popZone}`}
                          onCommit={(v) => patch(row, { [f.key]: v })}
                        />
                      ) : (
                        // Read-only viewers get a check/dash rather than a dead
                        // checkbox, which would imply the value is theirs to change.
                        <td key={f.key} className="jira-table-cell text-center">
                          <BooleanCell value={values[f.key]} label={f.label} />
                        </td>
                      )
                    ))}

                    <td className="jira-table-cell tabular-nums whitespace-nowrap text-neutral-500">
                      {formatDate(row.updatedAt)}
                    </td>

                    <td className="jira-table-cell">
                      <Link
                        href={`/design-sessions/${row.id}`}
                        aria-label={`Open ${row.popZone}`}
                        title="Open session"
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
