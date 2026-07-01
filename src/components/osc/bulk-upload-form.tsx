'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, UploadCloud, FileSpreadsheet, Download,
  CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'

interface RowData {
  partner: string
  popzone: string
  status: string
  priority: string
  remark: string
  oscRequestDate: string
  mailSentDate: string
  receivedDate: string
  updatedDate: string
}

interface ImportError {
  row: number
  message: string
  field?: string
  rowData?: RowData
}

interface ImportResult {
  created: number
  updated: number
  errors: ImportError[]
}

const STATUS_OPTIONS = [
  'On Hold',
  'OSC Updated',
  'Email Sent',
  'Email Sent + Reminder',
  'Check Remarks',
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'Not Defined' },
  { value: 'High Priority', label: 'High Priority' },
  { value: 'Medium Priority', label: 'Medium Priority' },
  { value: 'Low Priority', label: 'Low Priority' },
]

function normaliseStatus(raw: string): string {
  const map: Record<string, string> = {
    'osc updated': 'OSC Updated',
    'email sent': 'Email Sent',
    'email sent + reminder': 'Email Sent + Reminder',
    'email + reminder': 'Email Sent + Reminder',
    'on hold': 'On Hold',
    'check remarks': 'Check Remarks',
  }
  return map[raw.toLowerCase()] ?? ''
}

function normalisePriority(raw: string): string {
  const map: Record<string, string> = {
    'high priority': 'High Priority',
    'high': 'High Priority',
    'medium priority': 'Medium Priority',
    'medium': 'Medium Priority',
    'low priority': 'Low Priority',
    'low': 'Low Priority',
    'not defined': '',
    '': '',
  }
  return map[raw.toLowerCase()] ?? ''
}

function FixRowForm({ error, onFixed }: { error: ImportError; onFixed: () => void }) {
  const router = useRouter()
  const [fixing, setFixing] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)
  const rd = error.rowData!

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFixing(true)
    setFixError(null)
    const fd = new FormData(e.currentTarget)
    const payload: Record<string, string> = {}
    fd.forEach((v, k) => { payload[k] = String(v) })
    try {
      const res = await fetch('/api/osc/bulk/row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setFixError(data.error ?? 'Save failed')
      } else {
        router.refresh()
        onFixed()
      }
    } catch {
      setFixError('Network error — please try again')
    } finally {
      setFixing(false)
    }
  }

  const fieldCls = (field: string) =>
    `w-full text-xs border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 ${
      error.field === field
        ? 'border-red-400 bg-red-50 ring-1 ring-red-300'
        : 'border-gray-200 hover:border-gray-300'
    }`

  return (
    <form onSubmit={handleSubmit} className="mt-2 border border-gray-200 rounded-lg bg-gray-50 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Partner</label>
          <input name="partner" defaultValue={rd.partner} className={fieldCls('partner')} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Pop Zone</label>
          <input name="popzone" defaultValue={rd.popzone} className={fieldCls('popzone')} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Status</label>
          <select name="status" defaultValue={normaliseStatus(rd.status)} className={fieldCls('status')}>
            <option value="">— Select —</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Priority</label>
          <select name="priority" defaultValue={normalisePriority(rd.priority)} className={fieldCls('priority')}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">OSC Request Date</label>
          <input name="oscRequestDate" defaultValue={rd.oscRequestDate} placeholder="dd/MM/yyyy" className={fieldCls('oscRequestDate')} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Mail Sent Date</label>
          <input name="mailSentDate" defaultValue={rd.mailSentDate} placeholder="dd/MM/yyyy" className={fieldCls('mailSentDate')} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Received Date</label>
          <input name="receivedDate" defaultValue={rd.receivedDate} placeholder="dd/MM/yyyy" className={fieldCls('receivedDate')} />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Updated Date</label>
          <input name="updatedDate" defaultValue={rd.updatedDate} placeholder="dd/MM/yyyy" className={fieldCls('updatedDate')} />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Remark</label>
        <input
          name="remark"
          defaultValue={rd.remark}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 hover:border-gray-300"
        />
      </div>
      {fixError && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {fixError}
        </p>
      )}
      <button type="submit" disabled={fixing} className="jira-btn-primary text-xs py-1 px-3">
        {fixing && <Loader2 className="w-3 h-3 animate-spin" />}
        {fixing ? 'Saving…' : 'Save Row'}
      </button>
    </form>
  )
}

export function BulkUploadForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [fixedRows, setFixedRows] = useState<Set<number>>(new Set())

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const f = files[0]
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setFatalError('Please select an Excel file (.xlsx or .xls)')
      return
    }
    setFile(f)
    setResult(null)
    setFatalError(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function reset() {
    setFile(null)
    setResult(null)
    setFatalError(null)
    setExpandedRows(new Set())
    setFixedRows(new Set())
    if (inputRef.current) inputRef.current.value = ''
  }

  function toggleExpand(rowNum: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowNum)) next.delete(rowNum)
      else next.add(rowNum)
      return next
    })
  }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setResult(null)
    setFatalError(null)
    setExpandedRows(new Set())
    setFixedRows(new Set())
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/osc/bulk', { method: 'POST', body: fd })
      const body = await res.json()
      if (!res.ok && !('created' in body)) {
        throw new Error(body.error ?? 'Upload failed')
      }
      setResult(body)
      if (body.created > 0 || body.updated > 0) router.refresh()
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const unfixedErrorCount = result ? result.errors.filter((e) => !fixedRows.has(e.row)).length : 0

  return (
    <div className="space-y-4">
      {/* Template download */}
      <div className="jira-panel px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-800">Download template</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Fill in the template and upload it below. Dates should be formatted as dd/MM/yyyy.
          </p>
        </div>
        <a href="/api/osc/bulk" download className="jira-btn-secondary flex-shrink-0 no-underline">
          <Download className="w-4 h-4" />
          Template
        </a>
      </div>

      {/* Drop zone */}
      <div
        className={`jira-panel p-6 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
            <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="font-medium truncate max-w-xs">{file.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); reset() }}
              className="ml-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <UploadCloud className="w-8 h-8" />
            <p className="text-sm">
              <span className="font-medium text-blue-600">Click to browse</span> or drag & drop
            </p>
            <p className="text-xs">.xlsx or .xls files only</p>
          </div>
        )}
      </div>

      {fatalError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {fatalError}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="jira-panel p-4 space-y-3">
          {result.created > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>{result.created}</strong> request{result.created !== 1 ? 's' : ''} created.
              </span>
            </div>
          )}
          {result.updated > 0 && (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <RefreshCw className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>{result.updated}</strong> existing request{result.updated !== 1 ? 's' : ''} updated.
              </span>
            </div>
          )}
          {result.created === 0 && result.updated === 0 && result.errors.length === 0 && (
            <p className="text-sm text-gray-500">No data rows found to import.</p>
          )}
          {result.errors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                {unfixedErrorCount} row{unfixedErrorCount !== 1 ? 's' : ''} with issues
              </p>
              <ul className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                {result.errors.map((e, i) => {
                  if (fixedRows.has(e.row)) {
                    return (
                      <li key={i} className="text-xs text-green-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                        <span className="text-gray-400">Row {e.row}:</span>
                        Fixed successfully
                      </li>
                    )
                  }

                  const isExpanded = expandedRows.has(e.row)
                  return (
                    <li key={i} className="text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex gap-1.5 min-w-0">
                          <span className="text-gray-400 flex-shrink-0">Row {e.row}:</span>
                          <span className="text-red-600 break-words">{e.message}</span>
                        </div>
                        {e.rowData && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(e.row)}
                            className="flex-shrink-0 text-blue-500 hover:text-blue-700 flex items-center gap-0.5 font-medium"
                          >
                            {isExpanded
                              ? <><ChevronUp className="w-3 h-3" />Collapse</>
                              : <><ChevronDown className="w-3 h-3" />Fix</>}
                          </button>
                        )}
                      </div>
                      {isExpanded && e.rowData && (
                        <FixRowForm
                          error={e}
                          onFixed={() => {
                            setFixedRows((prev) => new Set(prev).add(e.row))
                            setExpandedRows((prev) => {
                              const s = new Set(prev)
                              s.delete(e.row)
                              return s
                            })
                          }}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!file || loading}
          onClick={handleUpload}
          className="jira-btn-primary"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Importing…' : 'Upload & Import'}
        </button>
        {result && (result.created > 0 || result.updated > 0) && (
          <a href="/osc" className="text-sm text-blue-600 hover:underline">
            View requests
          </a>
        )}
      </div>
    </div>
  )
}
