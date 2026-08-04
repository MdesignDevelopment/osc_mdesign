'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, X } from 'lucide-react'

// Deletion with a mandatory typed reason, mirroring the OSC delete flow: the
// reason is recorded as its own audit row so the trail explains *why*, not just
// that something disappeared.
export function DeleteRecordButton({
  endpoint, redirectTo, subject, confirmLabel,
}: {
  endpoint: string
  redirectTo: string
  /** What is being deleted, e.g. "MRO_HAALTERT_01_POP_011". */
  subject: string
  confirmLabel?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!reason.trim()) return
    setDeleting(true)
    setError(null)

    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body?.error ?? 'Could not delete this record.')
      setDeleting(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="jira-btn-danger text-xs">
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="relative bg-white rounded-xl border border-neutral-200 shadow-xl w-full max-w-md p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="delete-title" className="text-sm font-semibold text-neutral-900">
              {confirmLabel ?? 'Delete this record?'}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              <span className="font-medium">{subject}</span> will be removed. Its change history is
              kept and stays searchable.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="p-1 rounded text-neutral-300 hover:text-neutral-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label htmlFor="delete-reason" className="block text-xs font-medium text-neutral-500">
            Reason *
          </label>
          <textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Why is this being deleted?"
            className="jira-input w-full resize-none text-sm"
          />
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting || !reason.trim()}
            className="jira-btn-danger text-xs"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
          <button onClick={() => setOpen(false)} className="jira-btn-secondary text-xs">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
