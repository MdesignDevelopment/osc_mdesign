import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize, validationError, notFound, conflict } from '@/lib/api-auth'
import { addressActionPatchSchema } from '@/lib/validations'
import { auditRows, diffFields, ADDRESS_REQUEST_FIELDS } from '@/lib/audit'
import { addressLabel, validateAddressRecord } from '@/lib/addresses'

// Inline action change. Separate from PUT so a caller does not have to
// round-trip the whole record to move one request on or off hold.
//
// Was /api/addresses/[id]/status until migration 20260805000001; it no longer
// applies the §7.4 completion rules, because there are no longer any — setting
// an action never touches the completion date.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize('address:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const existing = await prisma.addressRequest.findUnique({ where: { id: params.id } })
  if (!existing) return notFound()

  const body = await req.json()
  const parsed = addressActionPatchSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { expectedUpdatedAt, action, completionDate } = parsed.data

  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
    return conflict('This request was changed by someone else. Reload to see the latest.', existing)
  }

  const next = {
    action,
    // Keep the stored date unless the caller sends one; an explicit null clears.
    completionDate: completionDate !== undefined
      ? (completionDate ? new Date(completionDate) : null)
      : existing.completionDate,
  }

  const invalid = validateAddressRecord({ ...existing, ...next })
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const changes = diffFields(
    existing as unknown as Record<string, unknown>,
    next as unknown as Record<string, unknown>,
    ADDRESS_REQUEST_FIELDS,
  )

  if (changes.length === 0) return NextResponse.json(existing)

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.addressRequest.update({ where: { id: params.id }, data: next })

    await tx.auditLog.createMany({
      data: auditRows({
        entity: 'ADDRESS_REQUEST',
        entityId: params.id,
        entityLabel: addressLabel(record),
        userId: session.user.id,
        action: 'UPDATE',
        changes,
      }),
    })

    return record
  })

  return NextResponse.json(updated)
}
