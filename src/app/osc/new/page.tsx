import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { OscForm } from '@/components/osc/osc-form'

export default async function NewOscPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role === 'EXTERN') redirect('/osc')

  const partners = await prisma.partner.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New OSC Request</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a new OSC tracking entry</p>
      </div>
      <OscForm partners={partners} />
    </div>
  )
}
