import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

// Duplicate POP zone detection, shared by the OSC list and the Design Session
// Tracker.
//
// WHY IT IS RAW SQL
// -----------------
// OscRequest.popzone is free text populated by several import paths, so casing
// and whitespace drift is expected — the same zone can appear as
// "MRO_GENK_01_POP_001" and " mro_genk_01_pop_001". Grouping has to happen on
// upper(btrim(popzone)), and Prisma cannot express a groupBy over an expression.
// Backed by idx_osc_request_popzone_norm, the same index the OSC Status
// projection uses.
//
// WHAT "DUPLICATE" MEANS PER MODULE
// ---------------------------------
// OSC: several requests share one POP zone. Legitimate by design (repeat
// requests over time) but also how accidental double entry looks, which is what
// the filter is for.
//
// Design Sessions: a duplicate session is impossible — DesignSession.popZoneKey
// is unique. There the filter means "this session's POP zone has more than one
// OSC request", i.e. the zones where the projected OSC Status is the most recent
// of several and therefore needs a human look (spec §6.4).

const DUPLICATE_KEYS = Prisma.sql`
  SELECT upper(btrim("popzone"))
  FROM "OscRequest"
  GROUP BY 1
  HAVING count(*) > 1
`

/** Normalised POP zone keys carried by more than one OSC request. */
export async function duplicatePopZoneKeys(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ key: string }[]>(Prisma.sql`
    SELECT upper(btrim("popzone")) AS key
    FROM "OscRequest"
    GROUP BY 1
    HAVING count(*) > 1
  `)
  return rows.map((r) => r.key)
}

/**
 * The raw `popzone` values belonging to a duplicated group.
 *
 * The OSC list filters with Prisma, which can only match the stored strings —
 * hence the values rather than the normalised keys. One row per spelling
 * variant, so the IN list stays in the hundreds, not the thousands.
 */
export async function duplicatePopZoneValues(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ popzone: string }[]>(Prisma.sql`
    SELECT DISTINCT "popzone"
    FROM "OscRequest"
    WHERE upper(btrim("popzone")) IN (${DUPLICATE_KEYS})
  `)
  return rows.map((r) => r.popzone)
}
