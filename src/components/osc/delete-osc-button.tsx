'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle } from 'lucide-react'

export function DeleteOscButton({ id }: { id: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  function handleOpen() {
    setReason('')
    setOpen(true)
  }

  function handleClose() {
    if (loading) return
    setReason('')
    setOpen(false)
  }

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/osc/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      if (res.ok) {
        router.push('/osc')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="jira-btn-secondary flex-shrink-0 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20 dark:hover:border-red-900"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={handleClose} />

          <div className="relative bg-white dark:bg-[#18181b] border border-[#e4e4e7] dark:border-[#27272a] rounded-xl shadow-2xl w-full max-w-[400px]">

            {/* Header */}
            <div className="flex items-start gap-3 p-5 pb-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center mt-0.5">
                <AlertTriangle className="w-4.5 h-4.5 text-red-600 dark:text-red-400 w-[18px] h-[18px]" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-[#09090b] dark:text-[#fafafa]">
                  Delete OSC Request?
                </h2>
                <p className="text-[12.5px] text-[#71717a] dark:text-[#52525b] mt-0.5 leading-relaxed">
                  This action cannot be undone. The deletion will be logged in history.
                </p>
              </div>
            </div>

            {/* Reason field */}
            <div className="px-5 pb-5">
              <label className="block text-[11.5px] font-medium text-[#52525b] dark:text-[#a1a1aa] uppercase tracking-wide mb-1.5">
                Reason <span className="normal-case tracking-normal text-[#a1a1aa] dark:text-[#52525b]">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Duplicate request, entered by mistake…"
                rows={3}
                className="jira-input resize-none text-[13px]"
                disabled={loading}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#f4f4f5] dark:border-[#27272a]">
              <button
                onClick={handleClose}
                disabled={loading}
                className="jira-btn-secondary text-[13px] py-[7px] px-4"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="jira-btn-danger text-[13px] py-[7px] px-4"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {loading ? 'Deleting…' : 'Delete Request'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
