import { Skeleton } from '@/components/ui/skeleton'

export default function OscDetailLoading() {
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3.5 w-32" />
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start">
        {/* Left: main content */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>

          {/* Description panel */}
          <div className="jira-panel p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Timeline */}
          <div className="jira-panel p-4 space-y-4">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="w-60 flex-shrink-0">
          <div className="jira-panel divide-y divide-slate-50">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-4 py-2.5 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
