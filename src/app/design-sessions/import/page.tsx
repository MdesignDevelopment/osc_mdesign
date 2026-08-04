import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Role } from '@prisma/client'
import { can } from '@/lib/permissions'
import { DesignSessionImportForm } from '@/components/design-sessions/design-session-import-form'

export default async function ImportDesignSessionsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!can(session.user.role as Role, 'design:write')) redirect('/design-sessions')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <Link href="/design-sessions" className="hover:text-blue-600 hover:underline">Design Sessions</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">Bulk Import</span>
      </nav>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">Bulk Import Design Sessions</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Create or update design sessions from a spreadsheet.
        </p>
      </div>

      <DesignSessionImportForm />
    </div>
  )
}
