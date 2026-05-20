import { Skeleton } from '@/components/ui/skeleton'

export default function UsersLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Add user button area */}
      <div className="flex justify-end">
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Table header */}
      <Skeleton className="h-10 rounded-t-lg" />

      {/* Table rows */}
      <div className="space-y-px">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-none" />
        ))}
      </div>
    </div>
  )
}
