import { Prisma, AddressRequestStatus } from '@prisma/client'

// Shared query + business rules for the Addresses Tracker, so the list page and
// the API routes cannot drift apart on filtering or the completion invariant.
// See SPEC-WYER-MERKATOR.md §7.

/** Human label for a request: whichever external identifier it carries. */
export function addressLabel(r: { tinaUuid: string | null; aapId: string | null }): string {
  return r.tinaUuid?.trim() || r.aapId?.trim() || 'Untitled request'
}

export const OPEN_STATUSES: readonly AddressRequestStatus[] = ['NOT_STARTED', 'ON_HOLD', 'BLOCKED']

export function isOpenStatus(status: AddressRequestStatus): boolean {
  return status !== 'COMPLETED'
}

/**
 * Reconcile status and completion date (spec §7.4).
 *
 * - COMPLETED with no date  → defaults to today, so the DB CHECK constraint can
 *   never be the thing that surfaces this to the user.
 * - Moving away from COMPLETED → the caller decides whether to clear the date;
 *   `clearCompletionDate` makes that explicit rather than implicit.
 */
export function resolveCompletion(input: {
  status: AddressRequestStatus
  completionDate: string | Date | null
  clearCompletionDate?: boolean
}): { status: AddressRequestStatus; completionDate: Date | null } {
  const { status, clearCompletionDate } = input

  if (status === 'COMPLETED') {
    const date = input.completionDate ? new Date(input.completionDate) : startOfToday()
    return { status, completionDate: date }
  }

  if (clearCompletionDate) return { status, completionDate: null }
  return { status, completionDate: input.completionDate ? new Date(input.completionDate) : null }
}

/**
 * Cross-field rules for a WHOLE address request, checked after a partial edit
 * has been merged onto the stored record.
 *
 * addressRequestSchema carries the same rules for full-record writes; a
 * single-cell PATCH cannot use it because the payload only holds one side of
 * each comparison. Both paths sit in front of the same DB CHECK constraints,
 * which stay the backstop.
 */
export function validateAddressRecord(r: {
  requestDate: Date
  tinaUuid: string | null
  aapId: string | null
  status: AddressRequestStatus
  completionDate: Date | null
}): string | null {
  if (!r.tinaUuid?.trim() && !r.aapId?.trim()) {
    return 'A request needs either a Tina UUID or an AAP ID.'
  }
  if (Number.isNaN(r.requestDate.getTime())) {
    return 'The request date is not a valid date.'
  }
  if (r.requestDate.getTime() > Date.now() + 86_400_000) {
    return 'The request date cannot be in the future.'
  }
  if (r.status === 'COMPLETED' && !r.completionDate) {
    return 'A completed request needs a completion date.'
  }
  if (r.completionDate && r.completionDate.getTime() < r.requestDate.getTime()) {
    return 'The completion date cannot precede the request date.'
  }
  return null
}

/** UTC midnight — matches the date-only storage convention (spec A8). */
export function startOfToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export interface AddressFilters {
  search?: string
  status?: string
  from?: string
  to?: string
  hideCompleted?: string
}

/**
 * Build the Prisma filter from URL params. Accepts either URLSearchParams (API
 * routes) or a plain searchParams object (server components).
 */
export function buildAddressWhere(
  params: URLSearchParams | AddressFilters,
): Prisma.AddressRequestWhereInput {
  const get = (key: keyof AddressFilters): string | undefined =>
    params instanceof URLSearchParams ? params.get(key) ?? undefined : params[key]

  const search = get('search')?.trim()
  const status = get('status')?.trim()
  const from = get('from')
  const to = get('to')
  // Default-on: the tracker is a work queue, so completed rows are hidden
  // unless explicitly asked for.
  const hideCompleted = get('hideCompleted') !== '0'

  const statuses = status
    ? status.split(',').filter((s): s is AddressRequestStatus =>
        (['NOT_STARTED', 'ON_HOLD', 'BLOCKED', 'COMPLETED'] as string[]).includes(s))
    : []

  return {
    ...(search && {
      OR: [
        { reporter: { contains: search, mode: 'insensitive' as const } },
        { tinaUuid: { contains: search, mode: 'insensitive' as const } },
        { aapId: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(statuses.length > 0
      ? { status: { in: statuses } }
      : hideCompleted
        ? { status: { in: [...OPEN_STATUSES] } }
        : {}),
    ...((from || to) && {
      requestDate: {
        ...(from && { gte: new Date(from + 'T00:00:00.000Z') }),
        ...(to && { lte: new Date(to + 'T23:59:59.999Z') }),
      },
    }),
  }
}

export type AddressSortKey =
  | 'requestDate' | 'reporter' | 'status' | 'completionDate'

export function buildAddressOrderBy(
  sort?: string,
  dir?: string,
): Prisma.AddressRequestOrderByWithRelationInput[] {
  const d: Prisma.SortOrder = dir === 'desc' ? 'desc' : 'asc'

  switch (sort) {
    case 'reporter':
      return [{ reporter: d }]
    case 'status':
      return [{ status: d }, { requestDate: 'desc' }]
    case 'completionDate':
      return [{ completionDate: { sort: d, nulls: 'last' } }]
    case 'requestDate':
      return [{ requestDate: d }]
    default:
      // Open work first, then oldest-requested first within each status —
      // ageing items rise to the top, which is the point of the tracker.
      return [{ status: 'asc' }, { requestDate: 'desc' }]
  }
}
