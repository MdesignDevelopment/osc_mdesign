import { Role } from '@prisma/client'

// Capability-based access control.
//
// This replaces the denylist pattern that used to guard the OSC write routes
// (`if (session.user.role === 'EXTERN') return 403`). A denylist grants every
// capability to any role it does not explicitly name, so adding a role to the
// Role enum silently handed it OSC write and delete access.
//
// MATRIX is typed `Record<Role, ...>`, so adding a value to the Role enum is a
// compile error until its capabilities are declared here. That is the point.
//
// See SPEC-WYER-MERKATOR.md §1.1 and §4.

export type Capability =
  | 'osc:read'
  | 'osc:write'
  | 'osc:delete'
  | 'osc:comment'
  | 'design:read'
  | 'design:write'
  | 'design:delete'
  | 'address:read'
  | 'address:write'
  | 'address:delete'
  | 'audit:read:osc'
  | 'audit:read:design'
  | 'audit:read:address'
  | 'scripts:ingest'
  | 'users:manage'
  | 'api:integration'

const ALL_CAPABILITIES: readonly Capability[] = [
  'osc:read', 'osc:write', 'osc:delete', 'osc:comment',
  'design:read', 'design:write', 'design:delete',
  'address:read', 'address:write', 'address:delete',
  'audit:read:osc', 'audit:read:design', 'audit:read:address',
  'scripts:ingest', 'users:manage', 'api:integration',
]

const MATRIX: Record<Role, readonly Capability[]> = {
  ADMIN: ALL_CAPABILITIES,

  SUPPORT_ENGINEER: [
    'osc:read', 'osc:write', 'osc:delete', 'osc:comment',
    'design:read', 'design:write',
    'address:read', 'address:write',
    'audit:read:osc', 'audit:read:design', 'audit:read:address',
    'api:integration',
  ],

  // Wyer/Merkator Support Engineer.
  //
  // Scope was widened twice by the product owner on 2026-08-03: first to read
  // the OSC Tracker, then to full read/write/delete. Deleting OSC requests is
  // the most consequential grant in this matrix, so `delete` is also extended to
  // the role's own two modules — being able to delete a shared OSC request but
  // not your own design session would be incoherent.
  //
  // Still withheld (never requested, and neither is "read/write/delete" on
  // operational records):
  //   users:manage    — creating and deprivileging accounts.
  //   api:integration — that page renders the live data-API key.
  //   scripts:ingest  — API-key authenticated machine ingest.
  WM_SUPPORT_ENGINEER: [
    'osc:read', 'osc:write', 'osc:delete', 'osc:comment',
    'design:read', 'design:write', 'design:delete',
    'address:read', 'address:write', 'address:delete',
    'audit:read:osc', 'audit:read:design', 'audit:read:address',
  ],

  EXTERN: ['osc:read', 'osc:comment'],
}

/**
 * Where each role starts. Explicit rather than derived from capabilities: the
 * Wyer/Merkator role can now read the OSC dashboard, but its actual work lives
 * in the two operational modules, so that is where it should land.
 */
const HOME: Record<Role, string> = {
  ADMIN: '/dashboard',
  SUPPORT_ENGINEER: '/dashboard',
  WM_SUPPORT_ENGINEER: '/design-sessions',
  EXTERN: '/osc',
}

/** The audit capabilities, in the order their tabs appear on /history. */
export const AUDIT_CAPABILITIES = [
  'audit:read:osc',
  'audit:read:design',
  'audit:read:address',
] as const satisfies readonly Capability[]

export function can(role: Role | string | undefined, cap: Capability): boolean {
  if (!role) return false
  return MATRIX[role as Role]?.includes(cap) ?? false
}

/** True when the role holds at least one of the given capabilities. */
export function canAny(role: Role | string | undefined, caps: readonly Capability[]): boolean {
  return caps.some((cap) => can(role, cap))
}

export function capabilitiesFor(role: Role | string | undefined): readonly Capability[] {
  if (!role) return []
  return MATRIX[role as Role] ?? []
}

/**
 * Where to send a user who lacks access to the page they asked for.
 *
 * Uses the role's declared HOME when that route is actually reachable for them,
 * then falls back through the capabilities they do hold — so a redirect can
 * never bounce someone to another page they are also barred from.
 * See SPEC-WYER-MERKATOR.md §4.5.
 */
export function landingRoute(role: Role | string | undefined): string {
  const home = role ? HOME[role as Role] : undefined
  if (home && isReachable(role, home)) return home

  if (can(role, 'design:read')) return '/design-sessions'
  if (can(role, 'address:read')) return '/addresses'
  if (can(role, 'osc:read')) return '/osc'
  return '/settings'
}

/** Capability required by each guarded route, for redirect-safety checks. */
const ROUTE_CAPABILITY: Record<string, Capability> = {
  '/dashboard': 'osc:read',
  '/osc': 'osc:read',
  '/design-sessions': 'design:read',
  '/addresses': 'address:read',
  '/users': 'users:manage',
  '/api-integration': 'api:integration',
}

function isReachable(role: Role | string | undefined, route: string): boolean {
  const cap = ROUTE_CAPABILITY[route]
  return cap ? can(role, cap) : true
}
