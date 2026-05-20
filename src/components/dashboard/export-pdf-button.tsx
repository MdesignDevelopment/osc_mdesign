'use client'

import { Download } from 'lucide-react'

export function ExportPdfButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/10 transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      Export PDF
    </button>
  )
}
