import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Role } from '@prisma/client'
import { can } from '@/lib/permissions'
import { DesignSessionForm } from '@/components/design-sessions/design-session-form'

export default async function NewDesignSessionPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!can(session.user.role as Role, 'design:write')) redirect('/design-sessions')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <Link href="/design-sessions" className="hover:text-blue-600 hover:underline">Design Sessions</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">New Session</span>
      </nav>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">New Design Session</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          One session per POP zone. The POP zone cannot be changed later.
        </p>
      </div>

      <DesignSessionForm mode="create" />
    </div>
  )
}
