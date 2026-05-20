import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { OscForm } from '@/components/osc/osc-form'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default async function EditOscPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role === 'EXTERN') redirect('/osc')

  const [request, partners] = await Promise.all([
    prisma.oscRequest.findUnique({
      where: { id: params.id },
      include: { partner: true },
    }),
    prisma.partner.findMany({ orderBy: { name: 'asc' } }),
  ])

  if (!request) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <Link href="/osc" className="hover:text-blue-600 hover:underline">OSC Requests</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/osc/${request.id}`} className="hover:text-blue-600 hover:underline">{request.popzone}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">Edit</span>
      </nav>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Edit OSC Request</h1>
        <p className="text-sm text-gray-500 mt-0.5">{request.popzone}</p>
      </div>
      <OscForm partners={partners} initialData={request} />
    </div>
  )
}
