import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Role } from '@prisma/client'
import { can } from '@/lib/permissions'
import { addressLabel } from '@/lib/addresses'
import { AddressForm } from '@/components/addresses/address-form'

function isoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

export default async function EditAddressPage({ params }: { params: { id: string } }) {
  noStore()
  const session = await getSession()
  if (!session) redirect('/login')
  if (!can(session.user.role as Role, 'address:write')) redirect('/addresses')

  const record = await prisma.addressRequest.findUnique({ where: { id: params.id } })
  if (!record) notFound()

  const label = addressLabel(record)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <Link href="/addresses" className="hover:text-blue-600 hover:underline">Addresses</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/addresses/${record.id}`} className="hover:text-blue-600 hover:underline">{label}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">Edit</span>
      </nav>

      <h1 className="text-xl font-semibold text-slate-900">Edit Address Request</h1>

      <AddressForm
        mode="edit"
        id={record.id}
        updatedAt={record.updatedAt.toISOString()}
        defaults={{
          requestDate: isoDate(record.requestDate),
          reporter: record.reporter,
          tinaUuid: record.tinaUuid ?? '',
          aapId: record.aapId ?? '',
          status: record.status,
          notes: record.notes ?? '',
          completionDate: isoDate(record.completionDate),
        }}
      />
    </div>
  )
}
