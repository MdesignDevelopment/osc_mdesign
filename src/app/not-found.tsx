'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Home } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0a] px-4">

      {/* Logo */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <Image src="/logo.png" alt="OSC Tracker" width={24} height={24} className="rounded" />
        <span className="text-sm font-semibold text-neutral-800 dark:text-white/80">OSC Tracker</span>
      </div>

      <div className="flex flex-col items-center text-center max-w-sm w-full">

        {/* Illustration */}
        <div className="w-full max-w-[340px] sm:max-w-[520px] mb-2">
          <Image
            src="/404.png"
            alt="404 illustration"
            width={1040}
            height={780}
            className="w-full h-auto"
            priority
          />
        </div>

        {/* Badge */}
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-white/[0.06] text-neutral-500 dark:text-neutral-400 text-[11px] font-medium tracking-widest uppercase mb-3">
          Error 404
        </span>

        <h1 className="text-[1.75rem] font-bold text-neutral-900 dark:text-white tracking-tight mb-2">
          Whoops.
        </h1>

        <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-8 max-w-[280px]">
          This page doesn&apos;t exist — but at least no chili was spilled finding it.
        </p>

        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="jira-btn-primary">
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <button onClick={() => router.back()} className="jira-btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
