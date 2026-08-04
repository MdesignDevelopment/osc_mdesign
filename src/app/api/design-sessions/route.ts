import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize, validationError } from '@/lib/api-auth'
import { designSessionCreateSchema } from '@/lib/validations'
import { auditRows, initialFields, DESIGN_SESSION_FIELDS } from '@/lib/audit'
import { buildDesignWhere, buildDesignOrderBy, resolveFlags, wantsDuplicatesOnly } from '@/lib/design-sessions'
import { duplicatePopZoneKeys } from '@/lib/duplicate-popzones'
import { projectOscStatuses } from '@/lib/osc-status-lookup'
import { popZoneKeyOf } from '@/lib/utils'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const auth = await authorize('design:read')
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)

  // ?dupes=1 — only zones carrying more than one OSC request. Looked up only
  // when asked for; it is a full scan of OscRequest.popzone.
  const dupeKeys = wantsDuplicatesOnly(searchParams) ? await duplicatePopZoneKeys() : undefined

  const sessions = await prisma.designSession.findMany({
    where: buildDesignWhere(searchParams, dupeKeys),
    orderBy: buildDesignOrderBy(searchParams.get('sort') ?? undefined, searchParams.get('dir') ?? undefined),
    include: { createdBy: { select: { name: true } } },
    take: 500,
  })

  // Batched — one extra query for the whole page, never per row.
  const oscStatuses = await projectOscStatuses(sessions.map((s) => s.popZoneKey))

  return NextResponse.json(
    sessions.map((s) => ({ ...s, oscStatus: oscStatuses.get(s.popZoneKey) ?? null })),
  )
}

export async function POST(req: NextRequest) {
  const auth = await authorize('design:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const body = await req.json()
  const parsed = designSessionCreateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const input = parsed.data
  const popZoneKey = popZoneKeyOf(input.popZone)

  const { flags, error } = resolveFlags(
    { sendOcRequestToPartner: false, aapOnHold: false, readyToPost: false, posted: false },
    {
      sendOcRequestToPartner: input.sendOcRequestToPartner,
      aapOnHold: input.aapOnHold,
      readyToPost: input.readyToPost,
      posted: input.posted,
    },
  )
  if (error) return NextResponse.json({ error }, { status: 400 })

  const data: Prisma.DesignSessionUncheckedCreateInput = {
    popZone: input.popZone.trim(),
    popZoneKey,
    cabinetName: input.cabinetName?.trim() || null,
    mroPartner: input.mroPartner?.trim() || null,
    notes: input.notes?.trim() || null,
    actionsDone: input.actionsDone?.trim() || null,
    // Stage is independent of the flags, so it is not part of resolveFlags.
    ...(input.stage && { stage: input.stage }),
    ...flags,
    createdById: session.user.id,
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const record = await tx.designSession.create({ data })

      // Adopt any script executions that arrived before this session existed
      // (spec §6.5) — they are keyed on popZoneKey, not the session FK.
      await tx.scriptExecution.updateMany({
        where: { popZoneKey, designSessionId: null },
        data: { designSessionId: record.id },
      })

      const initial = initialFields(record as unknown as Record<string, unknown>, DESIGN_SESSION_FIELDS)

      await tx.auditLog.createMany({
        data: auditRows({
          entity: 'DESIGN_SESSION',
          entityId: record.id,
          entityLabel: record.popZone,
          userId: session.user.id,
          action: 'CREATE',
          changes: initial,
        }),
      })

      return record
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: `A design session already exists for POP zone ${popZoneKey}.` },
        { status: 409 },
      )
    }
    throw e
  }
}
