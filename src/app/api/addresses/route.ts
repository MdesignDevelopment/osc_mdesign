import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize, validationError } from '@/lib/api-auth'
import { addressRequestSchema } from '@/lib/validations'
import { auditRows, initialFields, ADDRESS_REQUEST_FIELDS } from '@/lib/audit'
import { addressLabel, buildAddressWhere, resolveCompletion } from '@/lib/addresses'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const auth = await authorize('address:read')
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const where = buildAddressWhere(searchParams)

  const requests = await prisma.addressRequest.findMany({
    where,
    orderBy: [{ requestDate: 'desc' }],
    include: { createdBy: { select: { name: true } } },
    take: 500,
  })

  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  const auth = await authorize('address:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const body = await req.json()
  const parsed = addressRequestSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { expectedUpdatedAt: _ignored, ...input } = parsed.data

  // A COMPLETED request with no date supplied defaults to today (spec §7.4).
  const { status, completionDate } = resolveCompletion({
    status: input.status,
    completionDate: input.completionDate ?? null,
  })

  const data: Prisma.AddressRequestUncheckedCreateInput = {
    requestDate: new Date(input.requestDate),
    reporter: input.reporter.trim(),
    reportedById: input.reportedById || null,
    tinaUuid: input.tinaUuid?.trim() || null,
    aapId: input.aapId?.trim() || null,
    status,
    notes: input.notes?.trim() || null,
    completionDate,
    createdById: session.user.id,
  }

  const created = await prisma.$transaction(async (tx) => {
    const record = await tx.addressRequest.create({ data })

    // Initial values are logged alongside the CREATE summary row, so the
    // timeline shows what the record started as rather than just "created".
    const initial = initialFields(record as unknown as Record<string, unknown>, ADDRESS_REQUEST_FIELDS)

    await tx.auditLog.createMany({
      data: auditRows({
        entity: 'ADDRESS_REQUEST',
        entityId: record.id,
        entityLabel: addressLabel(record),
        userId: session.user.id,
        action: 'CREATE',
        changes: initial,
      }),
    })

    return record
  })

  return NextResponse.json(created, { status: 201 })
}
