import { prisma } from '@/lib/db'
import { OscStatus, Prisma } from '@prisma/client'
import { popZoneKeyOf } from '@/lib/utils'

// Read-only OSC Status projection for the Design Session Tracker.
//
// WHY THIS IS NOT A SIMPLE JOIN
// -----------------------------
// OscRequest.popzone is not unique. Measured against the committed dump:
// 1,636 POP zone occurrences across 387 distinct values (~4.2 requests per
// zone), and the model deliberately supports repeat requests over time. So
// "the OSC status for this record" needs an explicit disambiguation rule.
//
// RULE: most recently active request for the POP zone —
//   coalesce(updatedDate, oscRequestDate, receivedDate, createdAt) DESC,
//   then createdAt DESC as a tiebreak.
// This mirrors how the OSC list itself ranks recency.
//
// The match count travels with the result on purpose. A support engineer
// looking at a lone "Email Sent" lozenge, unaware three other requests exist
// for that zone, will draw the wrong conclusion — surfacing the count is the
// mitigation. See SPEC-WYER-MERKATOR.md §6.4.

export interface OscStatusProjection {
  status: OscStatus
  /** How many OSC requests exist for this POP zone (>= 1). */
  matchCount: number
  /** Id of the request the status came from, for drill-through. */
  oscRequestId: string
  effectiveDate: Date | null
}

type Candidate = {
  id: string
  popzone: string
  status: OscStatus
  updatedDate: Date | null
  oscRequestDate: Date | null
  receivedDate: Date | null
  createdAt: Date
}

function effectiveDateOf(r: Candidate): Date {
  return r.updatedDate ?? r.oscRequestDate ?? r.receivedDate ?? r.createdAt
}

/** True when `a` is more recent than `b` under the documented rule. */
function isMoreRecent(a: Candidate, b: Candidate): boolean {
  const da = effectiveDateOf(a).getTime()
  const db = effectiveDateOf(b).getTime()
  if (da !== db) return da > db
  return a.createdAt.getTime() > b.createdAt.getTime()
}

/**
 * Batched projection for a page of design sessions.
 *
 * ONE query for the whole page, then reduced in memory — Prisma cannot order by
 * a coalesce expression, and a per-row query would be an N+1 on every list
 * render. Backed by idx_osc_request_popzone_norm.
 */
export async function projectOscStatuses(
  popZoneKeys: readonly string[],
): Promise<Map<string, OscStatusProjection>> {
  const keys = Array.from(new Set(popZoneKeys.filter(Boolean)))
  const result = new Map<string, OscStatusProjection>()
  if (keys.length === 0) return result

  // Normalise the OscRequest side at query time: the two tables are populated
  // by different import paths, so casing/whitespace drift is expected.
  const candidates = await prisma.$queryRaw<Candidate[]>(Prisma.sql`
    SELECT id, popzone, status, "updatedDate", "oscRequestDate", "receivedDate", "createdAt"
    FROM "OscRequest"
    WHERE upper(btrim("popzone")) IN (${Prisma.join(keys)})
  `)

  const best = new Map<string, Candidate>()
  const counts = new Map<string, number>()

  for (const c of candidates) {
    const key = popZoneKeyOf(c.popzone)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    const incumbent = best.get(key)
    if (!incumbent || isMoreRecent(c, incumbent)) best.set(key, c)
  }

  // Array.from rather than iterating the Map directly: tsconfig targets es5.
  for (const [key, winner] of Array.from(best.entries())) {
    result.set(key, {
      status: winner.status,
      matchCount: counts.get(key) ?? 1,
      oscRequestId: winner.id,
      effectiveDate: effectiveDateOf(winner),
    })
  }

  return result
}

/** Single-record convenience wrapper for the detail view. */
export async function projectOscStatus(popZoneKey: string): Promise<OscStatusProjection | null> {
  const map = await projectOscStatuses([popZoneKey])
  return map.get(popZoneKey) ?? null
}
