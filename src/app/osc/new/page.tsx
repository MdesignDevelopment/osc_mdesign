import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { Role } from '@prisma/client'
import { redirect } from 'next/navigation'
import { NewOscTabs } from '@/components/osc/new-osc-tabs'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default async function NewOscPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!can(session.user.role as Role, 'osc:write')) redirect('/osc')

  const partners = await prisma.partner.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <Link href="/osc" className="hover:text-blue-600 hover:underline">OSC Requests</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">New Request</span>
      </nav>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New OSC Request</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a new OSC tracking entry</p>
      </div>
      <NewOscTabs partners={partners} />
    </div>
  )
}
