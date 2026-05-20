'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UploadCloud, FileSpreadsheet, Download, CheckCircle2, AlertCircle, X } from 'lucide-react'

interface ImportError {
  row: number
  message: string
}

interface ImportResult {
  created: number
  errors: ImportError[]
}

export function BulkUploadForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

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

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setResult(null)
    setFatalError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/osc/bulk', { method: 'POST', body: fd })
      const body = await res.json()
      if (!res.ok && !body.created && !body.errors) {
        throw new Error(body.error ?? 'Upload failed')
      }
      setResult(body)
      if (body.created > 0) router.refresh()
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setFile(null)
    setResult(null)
    setFatalError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

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
        <a
          href="/api/osc/bulk"
          download
          className="jira-btn-secondary flex-shrink-0 no-underline"
        >
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
              <span><strong>{result.created}</strong> request{result.created !== 1 ? 's' : ''} created successfully.</span>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-600 uppercase tracking-wide">
                {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600 flex gap-2">
                    <span className="text-gray-400 flex-shrink-0">Row {e.row}:</span>
                    {e.message}
                  </li>
                ))}
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
        {result?.created && result.created > 0 && (
          <a href="/osc" className="text-sm text-blue-600 hover:underline">
            View requests
          </a>
        )}
      </div>
    </div>
  )
}
