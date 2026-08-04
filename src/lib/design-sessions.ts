import { Prisma, DesignStage } from '@prisma/client'
import { DESIGN_STAGE_ORDER } from '@/lib/utils'

// Shared query + lifecycle rules for the Design Session Tracker.
// See SPEC-WYER-MERKATOR.md §6.

export interface DesignFlags {
  sendOcRequestToPartner: boolean
  aapOnHold: boolean
  readyToPost: boolean
  posted: boolean
}

export interface FlagResolution {
  flags: DesignFlags
  /** Blocking error — the transition is rejected. */
  error?: string
  /** Advisory messages; the change goes through. */
  warnings: string[]
  /** Fields the server set on the user's behalf (audited like any other change). */
  autoSet: (keyof DesignFlags)[]
}

/**
 * Apply the boolean lifecycle rules (spec §6.6).
 *
 * Only one hard block: un-ticking Ready to Post while Posted is set. Everything
 * else warns rather than blocks, because holds legitimately arrive late and
 * fighting reality just makes people work around the tracker.
 */
export function resolveFlags(current: DesignFlags, requested: Partial<DesignFlags>): FlagResolution {
  const next: DesignFlags = { ...current, ...stripUndefined(requested) }
  const warnings: string[] = []
  const autoSet: (keyof DesignFlags)[] = []

  // Posting implies readiness — auto-set rather than demanding two clicks.
  if (next.posted && !next.readyToPost) {
    // ...unless the caller is explicitly trying to un-tick readyToPost while
    // posted, which is the one contradiction we refuse.
    if (requested.readyToPost === false) {
      return {
        flags: current,
        error: 'Un-tick Posted first.',
        warnings,
        autoSet,
      }
    }
    next.readyToPost = true
    autoSet.push('readyToPost')
  }

  if (next.aapOnHold && next.readyToPost && !next.posted) {
    warnings.push('This session is marked ready to post.')
  }

  if (next.posted && next.aapOnHold) {
    warnings.push('AAP is still on hold.')
  }

  return { flags: next, warnings, autoSet }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>
}

export interface DesignFilters {
  search?: string
  partner?: string
  stage?: string
  hidePosted?: string
  dupes?: string
}

/** True when the caller asked for duplicate POP zones only. */
export function wantsDuplicatesOnly(params: URLSearchParams | DesignFilters): boolean {
  const value = params instanceof URLSearchParams ? params.get('dupes') : params.dupes
  return value === '1'
}

export function buildDesignWhere(
  params: URLSearchParams | DesignFilters,
  /**
   * Normalised keys of POP zones with more than one OSC request, from
   * lib/duplicate-popzones. Passed in rather than looked up here because this
   * builder is synchronous and shared by the page and the API route. Only
   * consulted when `dupes=1`; an empty list then correctly matches nothing.
   */
  duplicatePopZoneKeys?: readonly string[],
): Prisma.DesignSessionWhereInput {
  const get = (key: keyof DesignFilters): string | undefined =>
    params instanceof URLSearchParams ? params.get(key) ?? undefined : params[key]

  const search = get('search')?.trim()
  const partner = get('partner')?.trim()
  const stage = get('stage')?.trim()
  // Default-on: un-posted work first, since posted sessions are done.
  const hidePosted = get('hidePosted') !== '0'

  return {
    ...(search && {
      OR: [
        { popZone: { contains: search, mode: 'insensitive' as const } },
        { cabinetName: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(partner && { mroPartner: partner }),
    ...(wantsDuplicatesOnly(params) && {
      popZoneKey: { in: [...(duplicatePopZoneKeys ?? [])] },
    }),
    ...stageFilter(stage, hidePosted),
  }
}

/**
 * Stage is a stored column now, so filtering is a straight match.
 *
 * `hidePosted` is deliberately skipped when an explicit stage is chosen: it
 * filters on the `posted` FLAG, which is independent of the stage, and applying
 * both would silently hide rows the user just asked to see.
 */
function stageFilter(stage: string | undefined, hidePosted: boolean): Prisma.DesignSessionWhereInput {
  if (stage && (DESIGN_STAGE_ORDER as readonly string[]).includes(stage)) {
    return { stage: stage as DesignStage }
  }
  return hidePosted ? { posted: false } : {}
}

export function buildDesignOrderBy(
  sort?: string,
  dir?: string,
): Prisma.DesignSessionOrderByWithRelationInput[] {
  const d: Prisma.SortOrder = dir === 'desc' ? 'desc' : 'asc'

  switch (sort) {
    case 'popZone':
      return [{ popZone: d }]
    case 'cabinetName':
      return [{ cabinetName: { sort: d, nulls: 'last' } }]
    case 'mroPartner':
      return [{ mroPartner: { sort: d, nulls: 'last' } }]
    case 'stage':
      // The enum is declared in workflow order, so Postgres sorts it correctly
      // without a CASE expression (which Prisma could not express anyway).
      return [{ stage: d }, { updatedAt: 'desc' }]
    case 'updatedAt':
      return [{ updatedAt: d }]
    default:
      return [{ stage: 'asc' }, { updatedAt: 'desc' }]
  }
}
