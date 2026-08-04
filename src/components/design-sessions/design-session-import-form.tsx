'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, UploadCloud, FileSpreadsheet, Download,
  CheckCircle2, AlertCircle, AlertTriangle, X,
} from 'lucide-react'

interface ImportError {
  row: number
  message: string
  field?: string
}

interface ImportResult {
  created: number
  updated: number
  unchanged: number
  errors: ImportError[]
  warnings: string[]
}

export function DesignSessionImportForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)

    const body = new FormData()
    body.append('file', file)

    const res = await fetch('/api/design-sessions/bulk', { method: 'POST', body })
    const payload = await res.json().catch(() => ({}))
    setUploading(false)

    if (!res.ok && res.status !== 422) {
      setError(payload?.error ?? 'Upload failed.')
      return
    }

    setResult(payload as ImportResult)
    if ((payload?.created ?? 0) + (payload?.updated ?? 0) > 0) router.refresh()
  }

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="jira-panel p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Upload an XLSX file</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Rows are matched on POP Zone, so re-uploading updates existing sessions
              instead of duplicating them. Every change is recorded in the history.
            </p>
          </div>
          <a href="/api/design-sessions/bulk" className="jira-btn-secondary text-xs flex-shrink-0">
            <Download className="w-3.5 h-3.5" />
            Template
          </a>
        </div>

        <label
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-10 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setResult(null)
              setError(null)
            }}
          />
          {file ? (
            <>
              <FileSpreadsheet className="w-6 h-6 text-blue-500" />
              <span className="text-sm font-medium text-slate-700">{file.name}</span>
              <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-6 h-6 text-slate-300" />
              <span className="text-sm text-slate-500">Choose a file or drop it here</span>
              <span className="text-xs text-slate-400">XLSX up to 5 MB, 1000 rows</span>
            </>
          )}
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="jira-btn-primary text-xs"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            Import
          </button>
          {(file || result) && (
            <button onClick={reset} className="jira-btn-secondary text-xs">
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="jira-panel p-5 space-y-4">
          <div className="flex items-center gap-2">
            {result.errors.length === 0
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              : <AlertCircle className="w-4 h-4 text-amber-500" />}
            <p className="text-sm font-medium text-slate-800">Import summary</p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Stat label="Created" value={result.created} tone="text-emerald-600" />
            <Stat label="Updated" value={result.updated} tone="text-blue-600" />
            <Stat label="Unchanged" value={result.unchanged} tone="text-slate-400" />
            <Stat label="Errors" value={result.errors.length} tone={result.errors.length ? 'text-red-600' : 'text-slate-400'} />
          </div>

          {result.warnings?.length > 0 && (
            <div className="space-y-1">
              <p className="jira-section-header flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Warnings
              </p>
              <ul className="space-y-0.5">
                {result.warnings.map((w) => (
                  <li key={w} className="text-xs text-amber-700">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="jira-section-header">Skipped rows</p>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {result.errors.map((e) => (
                  <div key={`${e.row}-${e.message}`} className="px-3 py-2 flex items-start gap-2">
                    <span className="text-[11px] font-semibold text-slate-400 tabular-nums w-14 flex-shrink-0">
                      Row {e.row}
                    </span>
                    <span className="text-xs text-slate-600">{e.message}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Fix these rows in the spreadsheet and upload again — already-imported
                rows will be updated, not duplicated.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="border border-slate-200 rounded-lg px-3 py-2">
      <p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  )
}
