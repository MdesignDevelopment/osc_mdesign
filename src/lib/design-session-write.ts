import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize, validationError, notFound, conflict } from '@/lib/api-auth'
import { designSessionPatchSchema } from '@/lib/validations'
import { auditRows, diffFields, DESIGN_SESSION_FIELDS } from '@/lib/audit'
import { resolveFlags } from '@/lib/design-sessions'

/**
 * Partial write for a single design session — one grid cell or one flag at a
 * time (spec §6.3).
 *
 * Lives here rather than in a route file because two endpoints expose it:
 * PATCH /api/design-sessions/[id] (the grid) and the narrower, pre-existing
 * PATCH /api/design-sessions/[id]/flags. One implementation means the audit
 * trail and the lifecycle rules cannot drift between them.
 *
 * popZone is deliberately not patchable: it is the record identity, the OSC
 * Status join key and the script link key (spec §6.1).
 */
export async function patchDesignSession(req: NextRequest, id: string): Promise<NextResponse> {
  const auth = await authorize('design:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const existing = await prisma.designSession.findUnique({ where: { id } })
  if (!existing) return notFound()

  const body = await req.json()
  const parsed = designSessionPatchSchema.safeParse(body)
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

  // Only keys the caller actually sent are touched. An absent key keeps its
  // stored value; an explicit null or empty string clears it.
  const next: Record<string, unknown> = { ...flags }
  for (const key of ['cabinetName', 'mroPartner', 'notes', 'actionsDone'] as const) {
    if (input[key] !== undefined) next[key] = input[key]?.trim() || null
  }
  // Stage moves on its own — resolveFlags has no say over it.
  if (input.stage !== undefined) next.stage = input.stage

  const changes = diffFields(
    existing as unknown as Record<string, unknown>,
    next,
    DESIGN_SESSION_FIELDS,
  )

  if (changes.length === 0) {
    return NextResponse.json({ ...existing, warnings, autoSet })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.designSession.update({ where: { id }, data: next })

    // Every edit is audited, including a flag the server set on the user's
    // behalf, attributed to the same user and transaction.
    await tx.auditLog.createMany({
      data: auditRows({
        entity: 'DESIGN_SESSION',
        entityId: id,
        entityLabel: record.popZone,
        userId: session.user.id,
        action: 'UPDATE',
        changes,
      }),
    })

    return record
  })

  return NextResponse.json({ ...updated, warnings, autoSet })
}
