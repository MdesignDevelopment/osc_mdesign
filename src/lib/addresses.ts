import { Prisma, AddressAction } from '@prisma/client'

// Shared query + business rules for the Addresses Tracker, so the list page and
// the API routes cannot drift apart on filtering or validation.
// See SPEC-WYER-MERKATOR.md §7.
//
// The completion invariant that used to live here went away with the COMPLETED
// status (migration 20260805000001). `completionDate` is now an ordinary
// optional date: nothing auto-fills it, nothing clears it, and no state depends
// on it. The only rule left is that it cannot precede the request date.

/** Human label for a request: whichever external identifier it carries. */
export function addressLabel(r: { tinaUuid: string | null; aapId: string | null }): string {
  return r.tinaUuid?.trim() || r.aapId?.trim() || 'Untitled request'
}

export const ADDRESS_ACTIONS: readonly AddressAction[] = ['OFF_HOLD', 'ON_HOLD']

/**
 * Cross-field rules for a WHOLE address request, checked after a partial edit
 * has been merged onto the stored record.
 *
 * addressRequestSchema carries the same rules for full-record writes; a
 * single-cell PATCH cannot use it because the payload only holds one side of
 * each comparison. Both paths sit in front of the chk_address_identifier DB
 * constraint, which stays the backstop.
 */
export function validateAddressRecord(r: {
  requestDate: Date
  tinaUuid: string | null
  aapId: string | null
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
  if (r.completionDate && r.completionDate.getTime() < r.requestDate.getTime()) {
    return 'The completion date cannot precede the request date.'
  }
  return null
}

export interface AddressFilters {
  search?: string
  action?: string
  from?: string
  to?: string
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
  const action = get('action')?.trim()
  const from = get('from')
  const to = get('to')

  // There is no longer a terminal state, so nothing is hidden by default — the
  // old default-on "hide completed" filter went away with COMPLETED.
  const actions = action
    ? action.split(',').filter((a): a is AddressAction =>
        (ADDRESS_ACTIONS as readonly string[]).includes(a))
    : []

  return {
    ...(search && {
      OR: [
        { reporter: { contains: search, mode: 'insensitive' as const } },
        { popName: { contains: search, mode: 'insensitive' as const } },
        { tinaUuid: { contains: search, mode: 'insensitive' as const } },
        { aapId: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(actions.length > 0 && { action: { in: actions } }),
    ...((from || to) && {
      requestDate: {
        ...(from && { gte: new Date(from + 'T00:00:00.000Z') }),
        ...(to && { lte: new Date(to + 'T23:59:59.999Z') }),
      },
    }),
  }
}

export type AddressSortKey =
  | 'requestDate' | 'reporter' | 'popName' | 'action' | 'completionDate'

export function buildAddressOrderBy(
  sort?: string,
  dir?: string,
): Prisma.AddressRequestOrderByWithRelationInput[] {
  const d: Prisma.SortOrder = dir === 'desc' ? 'desc' : 'asc'

  switch (sort) {
    // reporter and popName are both optional now, so blanks sort to the bottom
    // rather than forming a block at the top of an ascending sort.
    case 'reporter':
      return [{ reporter: { sort: d, nulls: 'last' } }]
    case 'popName':
      return [{ popName: { sort: d, nulls: 'last' } }]
    case 'action':
      return [{ action: d }, { requestDate: 'desc' }]
    case 'completionDate':
      return [{ completionDate: { sort: d, nulls: 'last' } }]
    case 'requestDate':
      return [{ requestDate: d }]
    default:
      // Grouped by action, newest request first within each group.
      return [{ action: 'asc' }, { requestDate: 'desc' }]
  }
}
