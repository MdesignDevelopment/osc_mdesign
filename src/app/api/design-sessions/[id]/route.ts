import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize, validationError, notFound, conflict } from '@/lib/api-auth'
import { designSessionUpdateSchema, deleteWithReasonSchema } from '@/lib/validations'
import { auditRows, diffFields, DESIGN_SESSION_FIELDS } from '@/lib/audit'
import { resolveFlags } from '@/lib/design-sessions'
import { patchDesignSession } from '@/lib/design-session-write'
import { projectOscStatus } from '@/lib/osc-status-lookup'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize('design:read')
  if (!auth.ok) return auth.response

  const record = await prisma.designSession.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true, email: true } },
      scripts: { orderBy: { executedAt: 'desc' }, take: 50 },
    },
  })
  if (!record) return notFound()

  const [history, oscStatus] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entity: 'DESIGN_SESSION', entityId: params.id },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { changedAt: 'asc' },
    }),
    projectOscStatus(record.popZoneKey),
  ])

  return NextResponse.json({ ...record, history, oscStatus })
}

// Partial write — one grid cell or one flag at a time. PUT below rebuilds the
// whole record, so it is the wrong tool for a single cell: an omitted field
// there means "clear it".
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return patchDesignSession(req, params.id)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize('design:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const existing = await prisma.designSession.findUnique({ where: { id: params.id } })
  if (!existing) return notFound()

  const body = await req.json()
  const parsed = designSessionUpdateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { expectedUpdatedAt, ...input } = parsed.data

  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
    return conflict('This session was changed by someone else. Reload to see the latest.', existing)
  }

  const { flags, error, warnings, autoSet } = resolveFlags(existing, {
    sendOcRequestToPartner: input.sendOcRequestToPartner,
    aapOnHold: input.aapOnHold,
    readyToPost: input.readyToPost,
    posted: input.posted,
  })
  if (error) return NextResponse.json({ error }, { status: 400 })

  // popZone is absent from the update schema on purpose: it is the record
  // identity, the OSC Status join key and the script link key (spec §6.1).
  const next = {
    cabinetName: input.cabinetName?.trim() || null,
    mroPartner: input.mroPartner?.trim() || null,
    notes: input.notes?.trim() || null,
    actionsDone: input.actionsDone?.trim() || null,
    // Stage moves independently of the flags, so resolveFlags has no say in it.
    stage: input.stage ?? existing.stage,
    ...flags,
  }

  const changes = diffFields(
    existing as unknown as Record<string, unknown>,
    next as unknown as Record<string, unknown>,
    DESIGN_SESSION_FIELDS,
  )

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.designSession.update({ where: { id: params.id }, data: next })

    if (changes.length > 0) {
      await tx.auditLog.createMany({
        data: auditRows({
          entity: 'DESIGN_SESSION',
          entityId: params.id,
          entityLabel: record.popZone,
          userId: session.user.id,
          action: 'UPDATE',
          changes,
        }),
      })
    }

    return record
  })

  return NextResponse.json({ ...updated, warnings, autoSet })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize('design:delete')
  if (!auth.ok) return auth.response
  const { session } = auth

  const existing = await prisma.designSession.findUnique({ where: { id: params.id } })
  if (!existing) return notFound()

  const body = await req.json().catch(() => ({}))
  const parsed = deleteWithReasonSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.createMany({
      data: auditRows({
        entity: 'DESIGN_SESSION',
        entityId: params.id,
        entityLabel: existing.popZone,
        userId: session.user.id,
        action: 'DELETE',
        changes: [{ fieldChanged: 'deleteReason', oldValue: null, newValue: parsed.data.reason }],
      }),
    })

    // ScriptExecution.designSessionId is onDelete: SetNull, so the executions
    // survive and stay reachable by popZoneKey if the session is recreated.
    await tx.designSession.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ success: true })
}
