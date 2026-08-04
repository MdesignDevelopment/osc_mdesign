import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize, validationError, notFound, conflict } from '@/lib/api-auth'
import { addressStatusPatchSchema } from '@/lib/validations'
import { auditRows, diffFields, ADDRESS_REQUEST_FIELDS } from '@/lib/audit'
import { addressLabel, resolveCompletion } from '@/lib/addresses'

// Inline status change from the list view. Separate from PUT so the list does
// not have to round-trip the whole record. Applies the same §7.4 completion
// rules, including auto-dating a COMPLETED request.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize('address:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const existing = await prisma.addressRequest.findUnique({ where: { id: params.id } })
  if (!existing) return notFound()

  const body = await req.json()
  const parsed = addressStatusPatchSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { expectedUpdatedAt, status, completionDate, clearCompletionDate } = parsed.data

  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
    return conflict('This request was changed by someone else. Reload to see the latest.', existing)
  }

  const resolved = resolveCompletion({
    status,
    // Keep the stored date unless the caller sends one or asks to clear it.
    completionDate: completionDate ?? existing.completionDate,
    clearCompletionDate: clearCompletionDate ?? (status !== 'COMPLETED'),
  })

  const changes = diffFields(
    existing as unknown as Record<string, unknown>,
    resolved as unknown as Record<string, unknown>,
    ADDRESS_REQUEST_FIELDS,
  )

  if (changes.length === 0) return NextResponse.json(existing)

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.addressRequest.update({ where: { id: params.id }, data: resolved })

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
