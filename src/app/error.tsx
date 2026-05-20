'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Client error digest:', error.digest)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#f9fafb] dark:bg-[#0a0a0a] px-4">

      {/* Logo */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <Image src="/logo.png" alt="OSC Tracker" width={24} height={24} className="rounded" />
        <span className="text-sm font-semibold text-neutral-800 dark:text-white/80">OSC Tracker</span>
      </div>

      {/* Background watermark */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      >
        <span className="text-[120px] sm:text-[200px] font-black leading-none tracking-tighter text-neutral-100 dark:text-white/[0.025]">
          Error
        </span>
      </div>

      <div className="relative flex flex-col items-center text-center max-w-sm">

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-center justify-center mb-6 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>

        {/* Badge */}
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-white/[0.06] text-neutral-500 dark:text-neutral-400 text-[11px] font-medium tracking-widest uppercase mb-3">
          Application Error
        </span>

        <h1 className="text-[1.75rem] font-bold text-neutral-900 dark:text-white tracking-tight mb-2">
          Something went wrong
        </h1>

        <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-8 max-w-[280px]">
          An unexpected error occurred. Try again — if the problem persists, contact support.
        </p>

        <div className="flex items-center gap-3">
          <button onClick={reset} className="jira-btn-primary">
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <Link href="/dashboard" className="jira-btn-secondary">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 text-[11px] font-mono text-neutral-300 dark:text-neutral-700">
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
