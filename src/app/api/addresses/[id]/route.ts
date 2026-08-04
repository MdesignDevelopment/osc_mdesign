import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize, validationError, notFound, conflict } from '@/lib/api-auth'
import { addressRequestSchema, addressPatchSchema, deleteWithReasonSchema } from '@/lib/validations'
import { auditRows, diffFields, ADDRESS_REQUEST_FIELDS } from '@/lib/audit'
import { addressLabel, resolveCompletion, validateAddressRecord } from '@/lib/addresses'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize('address:read')
  if (!auth.ok) return auth.response

  const record = await prisma.addressRequest.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true, email: true } },
      reportedBy: { select: { name: true } },
    },
  })
  if (!record) return notFound()

  const history = await prisma.auditLog.findMany({
    where: { entity: 'ADDRESS_REQUEST', entityId: params.id },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { changedAt: 'asc' },
  })

  return NextResponse.json({ ...record, history })
}

/**
 * Partial write — one grid cell at a time.
 *
 * PUT below is the wrong tool for that: it rebuilds the record, so an omitted
 * field means "clear it". Here only the keys the caller sent move, and the
 * cross-field rules are checked against the merged record rather than the
 * fragment on the wire.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize('address:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const existing = await prisma.addressRequest.findUnique({ where: { id: params.id } })
  if (!existing) return notFound()

  const body = await req.json()
  const parsed = addressPatchSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { expectedUpdatedAt, clearCompletionDate, ...input } = parsed.data

  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
    return conflict('This request was changed by someone else. Reload to see the latest.', existing)
  }

  const merged = {
    requestDate: input.requestDate !== undefined ? new Date(input.requestDate) : existing.requestDate,
    reporter: input.reporter !== undefined ? input.reporter.trim() : existing.reporter,
    reportedById: input.reportedById !== undefined ? (input.reportedById || null) : existing.reportedById,
    tinaUuid: input.tinaUuid !== undefined ? (input.tinaUuid?.trim() || null) : existing.tinaUuid,
    aapId: input.aapId !== undefined ? (input.aapId?.trim() || null) : existing.aapId,
    status: input.status ?? existing.status,
    notes: input.notes !== undefined ? (input.notes?.trim() || null) : existing.notes,
    completionDate: input.completionDate !== undefined
      ? (input.completionDate ? new Date(input.completionDate) : null)
      : existing.completionDate,
  }

  // §7.4: leaving COMPLETED clears the date, unless this very request set one.
  const leavingCompleted = existing.status === 'COMPLETED' && merged.status !== 'COMPLETED'
  const { status, completionDate } = resolveCompletion({
    status: merged.status,
    completionDate: merged.completionDate,
    clearCompletionDate: clearCompletionDate ?? (leavingCompleted && input.completionDate === undefined),
  })

  const next = { ...merged, status, completionDate }

  const invalid = validateAddressRecord(next)
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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize('address:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const existing = await prisma.addressRequest.findUnique({ where: { id: params.id } })
  if (!existing) return notFound()

  const body = await req.json()
  const parsed = addressRequestSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { expectedUpdatedAt, ...input } = parsed.data

  // Optimistic concurrency (spec §10.1): reject rather than silently clobbering
  // a concurrent edit, which would also make the audit trail imply a sequence
  // that never logically happened.
  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
    return conflict('This request was changed by someone else. Reload to see the latest.', existing)
  }

  const { status, completionDate } = resolveCompletion({
    status: input.status,
    completionDate: input.completionDate ?? null,
    // Moving away from COMPLETED clears the date unless one was sent explicitly.
    clearCompletionDate: input.status !== 'COMPLETED' && !input.completionDate,
  })

  const next = {
    requestDate: new Date(input.requestDate),
    reporter: input.reporter.trim(),
    reportedById: input.reportedById || null,
    tinaUuid: input.tinaUuid?.trim() || null,
    aapId: input.aapId?.trim() || null,
    status,
    notes: input.notes?.trim() || null,
    completionDate,
  }

  const changes = diffFields(
    existing as unknown as Record<string, unknown>,
    next as unknown as Record<string, unknown>,
    ADDRESS_REQUEST_FIELDS,
  )

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.addressRequest.update({ where: { id: params.id }, data: next })

    if (changes.length > 0) {
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
    }

    return record
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize('address:delete')
  if (!auth.ok) return auth.response
  const { session } = auth

  const existing = await prisma.addressRequest.findUnique({ where: { id: params.id } })
  if (!existing) return notFound()

  const body = await req.json().catch(() => ({}))
  const parsed = deleteWithReasonSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  await prisma.$transaction(async (tx) => {
    // Audit rows are written BEFORE the delete, and entityId is not an FK, so
    // the trail survives the record intact (spec §3.5).
    await tx.auditLog.createMany({
      data: auditRows({
        entity: 'ADDRESS_REQUEST',
        entityId: params.id,
        entityLabel: addressLabel(existing),
        userId: session.user.id,
        action: 'DELETE',
        changes: [{ fieldChanged: 'deleteReason', oldValue: null, newValue: parsed.data.reason }],
      }),
    })

    await tx.addressRequest.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ success: true })
}
