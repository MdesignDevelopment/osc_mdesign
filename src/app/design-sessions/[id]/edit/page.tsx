import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Role } from '@prisma/client'
import { can } from '@/lib/permissions'
import { DesignSessionForm } from '@/components/design-sessions/design-session-form'

export default async function EditDesignSessionPage({ params }: { params: { id: string } }) {
  noStore()
  const session = await getSession()
  if (!session) redirect('/login')
  if (!can(session.user.role as Role, 'design:write')) redirect('/design-sessions')

  const record = await prisma.designSession.findUnique({ where: { id: params.id } })
  if (!record) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <Link href="/design-sessions" className="hover:text-blue-600 hover:underline">Design Sessions</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/design-sessions/${record.id}`} className="hover:text-blue-600 hover:underline font-mono">
          {record.popZone}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">Edit</span>
      </nav>

      <h1 className="text-xl font-semibold text-slate-900">Edit Design Session</h1>

      <DesignSessionForm
        mode="edit"
        id={record.id}
        updatedAt={record.updatedAt.toISOString()}
        defaults={{
          popZone: record.popZone,
          cabinetName: record.cabinetName ?? '',
          mroPartner: record.mroPartner ?? '',
          notes: record.notes ?? '',
          actionsDone: record.actionsDone ?? '',
          stage: record.stage,
          sendOcRequestToPartner: record.sendOcRequestToPartner,
          aapOnHold: record.aapOnHold,
          readyToPost: record.readyToPost,
          posted: record.posted,
        }}
      />
    </div>
  )
}
