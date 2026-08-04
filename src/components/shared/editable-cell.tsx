'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// Spreadsheet-style cell editing for the tracker tables.
//
// WHY DOM QUERIES INSTEAD OF A CONTEXT
// ------------------------------------
// Grid navigation needs to answer "which cell is left of this one" across rows
// that render different numbers of editable columns (the draft row has no OSC
// Status, read-only columns register nothing at all). A React context would have
// to mirror that geometry in state and keep it in sync with every render; the
// DOM already holds it exactly. Cells tag themselves with data-grid/row/col and
// navigation walks the tagged set, so read-only columns are skipped for free and
// column indices are allowed to have gaps.
//
// The draft row uses row index -1 so it sorts above row 0 — arrow-up from the
// first real row lands in it.

export type CellKind = 'text' | 'select' | 'date'

export interface CellOption {
  value: string
  label: string
}

const DRAFT_ROW = -1
export { DRAFT_ROW }

function attr(el: HTMLElement, key: 'row' | 'col'): number {
  return Number(el.dataset[key])
}

function cellsOf(gridId: string, selector: string): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[data-grid="${gridId}"]${selector}`),
  )
}

/**
 * Move focus one step through the grid. Returns false when there is nothing in
 * that direction, so callers can fall back (e.g. Tab at the end of a row).
 */
export function moveFocus(
  gridId: string, row: number, col: number, dRow: number, dCol: number,
): boolean {
  if (dCol !== 0) {
    const inRow = cellsOf(gridId, `[data-row="${row}"]`).sort((a, b) => attr(a, 'col') - attr(b, 'col'))
    const i = inRow.findIndex((el) => attr(el, 'col') === col)
    const target = inRow[i + dCol]
    target?.focus()
    return Boolean(target)
  }

  const inCol = cellsOf(gridId, `[data-col="${col}"]`).sort((a, b) => attr(a, 'row') - attr(b, 'row'))
  const i = inCol.findIndex((el) => attr(el, 'row') === row)
  const target = inCol[i + dRow]
  target?.focus()
  return Boolean(target)
}

/** Focus the leftmost editable cell of a row — used when the draft row opens. */
export function focusRowStart(gridId: string, row: number): void {
  const first = cellsOf(gridId, `[data-row="${row}"]`)
    .sort((a, b) => attr(a, 'col') - attr(b, 'col'))[0]
  first?.focus()
}

/** Arrow-key navigation shared by idle cells and draft inputs. */
function navKey(e: KeyboardEvent, gridId: string, row: number, col: number): boolean {
  const map: Record<string, [number, number]> = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
  }
  const delta = map[e.key]
  if (!delta) return false
  e.preventDefault()
  moveFocus(gridId, row, col, delta[0], delta[1])
  return true
}

const EDIT_INPUT =
  'w-full bg-white text-[13px] px-1.5 py-1 -mx-1.5 -my-1 rounded border border-blue-500 ' +
  'outline-none ring-2 ring-blue-500/20'

interface EditableCellProps {
  gridId: string
  row: number
  col: number
  /** Committed value. '' for empty; `yyyy-MM-dd` for dates. */
  value: string
  kind?: CellKind
  options?: CellOption[]
  editable?: boolean
  placeholder?: string
  ariaLabel: string
  /** What to show when idle. Defaults to the raw value, or an em dash if empty. */
  display?: ReactNode
  className?: string
  saving?: boolean
  maxLength?: number
  onCommit: (next: string) => void | Promise<void>
}

/**
 * One editable cell of an existing row: click (or Enter, or just start typing)
 * to edit, Enter to commit and drop to the row below, Escape to abandon.
 */
export function EditableCell({
  gridId, row, col, value, kind = 'text', options, editable = true,
  placeholder, ariaLabel, display, className, saving, maxLength, onCommit,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const idleRef = useRef<HTMLDivElement>(null)
  // Enter/Tab/Escape all unmount the editor, which fires blur straight after.
  // Without this the cell would commit twice, or commit a value it just cancelled.
  const handledRef = useRef(false)

  // A router.refresh() can land while the cell sits idle; adopt the server value.
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const shown = display ?? (value || <span className="text-neutral-300">—</span>)

  function begin(seed?: string) {
    if (!editable || saving) return
    setDraft(seed ?? value)
    setEditing(true)
  }

  function backToIdle() {
    setEditing(false)
    // The editor is gone by the next frame, so the cell can take focus back.
    requestAnimationFrame(() => idleRef.current?.focus())
  }

  // `handledRef` is set by whoever *decides* to end the edit, never by commit
  // itself: commit is also the blur path, and self-arming the guard there would
  // make the next blur a no-op.
  async function commit(next: string, after?: () => void) {
    setEditing(false)
    if (next.trim() !== value) await onCommit(next.trim())
    if (after) requestAnimationFrame(after)
    else requestAnimationFrame(() => idleRef.current?.focus())
  }

  function onIdleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (navKey(e, gridId, row, col)) return
    if (!editable) return

    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      begin()
      return
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && kind !== 'select' && value) {
      e.preventDefault()
      void commit('')
      return
    }
    // Type-to-replace, exactly as a spreadsheet does.
    if (kind === 'text' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      begin(e.key)
    }
  }

  function onEditKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      handledRef.current = true
      setDraft(value)
      backToIdle()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      handledRef.current = true
      void commit(draft, () => {
        if (!moveFocus(gridId, row, col, 1, 0)) idleRef.current?.focus()
      })
      return
    }
    if (e.key === 'Tab') {
      // Committing unmounts the editor mid-Tab, so focus is moved explicitly
      // rather than left to the browser's default sequence.
      e.preventDefault()
      handledRef.current = true
      const dir = e.shiftKey ? -1 : 1
      void commit(draft, () => {
        if (!moveFocus(gridId, row, col, 0, dir)) idleRef.current?.focus()
      })
      return
    }
    // Only plain text cells treat up/down as commit-and-move: in a date input or
    // a select those keys belong to the editor itself.
    if (kind === 'text' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      handledRef.current = true
      const d = e.key === 'ArrowDown' ? 1 : -1
      void commit(draft, () => {
        if (!moveFocus(gridId, row, col, d, 0)) idleRef.current?.focus()
      })
    }
  }

  function onEditBlur() {
    if (handledRef.current) {
      handledRef.current = false
      return
    }
    void commit(draft)
  }

  return (
    <td
      className={cn(
        'jira-table-cell relative p-0',
        editable && 'group/cell',
        className,
      )}
    >
      {editing ? (
        <div className="px-4 py-2.5">
          {kind === 'select' ? (
            <select
              autoFocus
              aria-label={ariaLabel}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                handledRef.current = true
                void commit(e.target.value)
              }}
              onKeyDown={onEditKeyDown}
              onBlur={onEditBlur}
              className={cn(EDIT_INPUT, 'cursor-pointer')}
            >
              {options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              autoFocus
              type={kind === 'date' ? 'date' : 'text'}
              aria-label={ariaLabel}
              value={draft}
              placeholder={placeholder}
              maxLength={maxLength}
              onChange={(e) => setDraft(e.target.value)}
              // select() is only defined for text-like inputs — Firefox throws
              // InvalidStateError on a date input.
              onFocus={kind === 'text' ? (e) => e.currentTarget.select() : undefined}
              onKeyDown={onEditKeyDown}
              onBlur={onEditBlur}
              className={EDIT_INPUT}
            />
          )}
        </div>
      ) : (
        <div
          ref={idleRef}
          {...(editable ? { 'data-grid': gridId, 'data-row': row, 'data-col': col } : {})}
          tabIndex={editable ? 0 : -1}
          aria-label={editable ? `${ariaLabel} — press Enter to edit` : undefined}
          title={editable ? `${ariaLabel} — click to edit` : undefined}
          onClick={editable ? () => begin() : undefined}
          onKeyDown={onIdleKeyDown}
          className={cn(
            'px-4 py-2.5 min-h-[40px] flex items-center gap-1.5 outline-none',
            editable && [
              'cursor-text rounded-sm',
              'hover:bg-blue-50/40 hover:ring-1 hover:ring-inset hover:ring-blue-200',
              'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
            ],
          )}
        >
          <span className="min-w-0 truncate">{shown}</span>
          {saving && <Loader2 className="w-3 h-3 animate-spin text-neutral-300 shrink-0" />}
        </div>
      )}
    </td>
  )
}

/**
 * A checkbox cell. No edit mode — the control *is* the value — but it joins the
 * same grid so arrow keys cross between text and boolean columns.
 */
export function EditableCheckboxCell({
  gridId, row, col, value, ariaLabel, editable = true, saving, onCommit, className,
}: {
  gridId: string
  row: number
  col: number
  value: boolean
  ariaLabel: string
  editable?: boolean
  saving?: boolean
  onCommit: (next: boolean) => void | Promise<void>
  className?: string
}) {
  return (
    <td className={cn('jira-table-cell text-center', className)}>
      <input
        type="checkbox"
        {...(editable ? { 'data-grid': gridId, 'data-row': row, 'data-col': col } : {})}
        checked={value}
        disabled={!editable || saving}
        aria-label={ariaLabel}
        onChange={(e) => void onCommit(e.target.checked)}
        onKeyDown={(e) => navKey(e, gridId, row, col)}
        className={cn(
          'rounded border-neutral-300 text-blue-600 cursor-pointer',
          'focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      />
    </td>
  )
}

/**
 * A cell of the pending new row. Always in edit mode — the row exists only to be
 * filled in — with Enter saving the row and Escape discarding it.
 */
export function DraftCell({
  gridId, col, value, kind = 'text', options, placeholder, ariaLabel,
  onChange, onSave, onCancel, disabled, invalid, maxLength, className, autoFocus,
}: {
  gridId: string
  col: number
  value: string
  kind?: CellKind
  options?: CellOption[]
  placeholder?: string
  ariaLabel: string
  onChange: (next: string) => void
  onSave: () => void
  onCancel: () => void
  disabled?: boolean
  invalid?: boolean
  maxLength?: number
  className?: string
  autoFocus?: boolean
}) {
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    // Vertical arrows leave the draft row for the grid; Tab stays native so the
    // row fills in reading order.
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      navKey(e, gridId, DRAFT_ROW, col)
    }
  }

  const shared = {
    'data-grid': gridId,
    'data-row': DRAFT_ROW,
    'data-col': col,
    'aria-label': ariaLabel,
    'aria-invalid': invalid || undefined,
    disabled,
    autoFocus,
    onKeyDown,
    className: cn(
      'w-full text-[13px] px-2 py-1 rounded border bg-white outline-none',
      'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
      invalid ? 'border-red-400 bg-red-50/40' : 'border-neutral-200',
      'disabled:opacity-50',
    ),
  }

  return (
    <td className={cn('jira-table-cell px-4 py-2', className)}>
      {kind === 'select' ? (
        <select {...shared} value={value} onChange={(e) => onChange(e.target.value)}>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          {...shared}
          type={kind === 'date' ? 'date' : 'text'}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </td>
  )
}

/**
 * The add-row control: a "+" centred on the table's top edge (§ user request),
 * so it reads as "add a line here" rather than as another toolbar button.
 */
export function AddRowBar({
  onClick, label, disabled, busy,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <div className="flex justify-center border-b border-neutral-100 bg-neutral-50/60 py-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        title={`${label} (adds an empty row you can type into)`}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium',
          'text-neutral-500 hover:text-blue-600 hover:bg-blue-50 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        {busy
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Plus className="w-3.5 h-3.5" />}
        {label}
      </button>
    </div>
  )
}

/** Save / discard buttons for the pending row. */
export function DraftActions({
  onSave, onCancel, saving,
}: {
  onSave: () => void
  onCancel: () => void
  saving?: boolean
}) {
  return (
    <td className="jira-table-cell px-4 py-2 whitespace-nowrap">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="jira-btn-primary text-[11px] px-2 py-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="jira-btn-secondary text-[11px] px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </td>
  )
}
