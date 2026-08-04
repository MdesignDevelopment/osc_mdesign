import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateApiKey } from '@/lib/api-key'
import { checkRateLimit } from '@/lib/rate-limit'
import { scriptExecutionIngestPayloadSchema } from '@/lib/validations'
import { popZoneKeyOf } from '@/lib/utils'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Script execution ingest for the Design Session Tracker (spec §6.5).
//
// Authenticated with the daily-rotating API key rather than a user session,
// matching /api/v1/osc-requests — the caller is a script runner, not a person.
//
// Design notes:
//   - Rows are keyed on popZoneKey, NOT on a design session FK. Executions
//     legitimately arrive before a session exists; they are adopted when one is
//     created. Dropping them would silently lose data.
//   - `externalRef` is a unique idempotency key, so a runner that retries a POST
//     does not create duplicates.
//   - `output` is truncated at ingest. An unbounded @db.Text column fed by CI
//     logs is a storage incident waiting to happen.

const MAX_OUTPUT_BYTES = 64 * 1024
const TRUNCATION_MARKER = '\n… [truncated]'

function truncateOutput(output: string | null | undefined): string | null {
  if (!output) return null
  if (output.length <= MAX_OUTPUT_BYTES) return output
  return output.slice(0, MAX_OUTPUT_BYTES - TRUNCATION_MARKER.length) + TRUNCATION_MARKER
}

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('api_key')

  if (!validateApiKey(key)) {
    return NextResponse.json(
      {
        error:
          'Invalid or expired API key. Keys rotate daily at midnight UTC — copy the current key from the API Integration page in the OSC Tracker app.',
      },
      { status: 401 },
    )
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const limit = checkRateLimit(`script-ingest:${ip}`, 120, 60 * 1000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } },
    )
  }

  const body = await req.json().catch(() => null)
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const parsed = scriptExecutionIngestPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data]

  // Resolve design sessions once for the whole batch.
  const popZoneKeys = Array.from(new Set(items.map((i) => popZoneKeyOf(i.popZone))))
  const sessions = await prisma.designSession.findMany({
    where: { popZoneKey: { in: popZoneKeys } },
    select: { id: true, popZoneKey: true },
  })
  const sessionByKey = new Map(sessions.map((s) => [s.popZoneKey, s.id]))

  // Idempotency: anything we have already seen is a no-op, not a duplicate.
  const refs = items.map((i) => i.externalRef).filter((r): r is string => Boolean(r))
  const seen = refs.length
    ? await prisma.scriptExecution.findMany({
        where: { externalRef: { in: refs } },
        select: { externalRef: true },
      })
    : []
  const seenRefs = new Set(seen.map((s) => s.externalRef))

  const toCreate: Prisma.ScriptExecutionUncheckedCreateInput[] = []
  let skipped = 0

  for (const item of items) {
    if (item.externalRef && seenRefs.has(item.externalRef)) {
      skipped++
      continue
    }

    const popZoneKey = popZoneKeyOf(item.popZone)
    toCreate.push({
      popZoneKey,
      // Null when no session exists yet — deliberately NOT auto-created.
      designSessionId: sessionByKey.get(popZoneKey) ?? null,
      scriptName: item.scriptName.trim(),
      scriptVersion: item.scriptVersion?.trim() || null,
      status: item.status,
      executedAt: new Date(item.executedAt),
      durationMs: item.durationMs ?? null,
      output: truncateOutput(item.output),
      executedByLabel: item.executedByLabel?.trim() || null,
      externalRef: item.externalRef?.trim() || null,
    })
  }

  // skipDuplicates guards the race where two concurrent batches carry the same
  // externalRef and both pass the check above.
  const result = toCreate.length
    ? await prisma.scriptExecution.createMany({ data: toCreate, skipDuplicates: true })
    : { count: 0 }

  const unmatched = popZoneKeys.filter((k) => !sessionByKey.has(k))

  return NextResponse.json(
    {
      received: items.length,
      created: result.count,
      skipped,
      // Surfaced rather than hidden: these executions are stored and will attach
      // automatically once a design session is created for the zone.
      popZonesWithoutSession: unmatched,
    },
    { status: 201 },
  )
}
