import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { getSession } from '@/lib/auth'
import { can, type Capability } from '@/lib/permissions'
import { Role } from '@prisma/client'

// Route-level authorization that returns a response rather than throwing, so it
// drops into the early-return style the existing API routes already use:
//
//   const auth = await authorize('design:write')
//   if (!auth.ok) return auth.response
//   const { session } = auth
//
// See SPEC-WYER-MERKATOR.md §4.1.

type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse }

export async function authorize(cap: Capability): Promise<AuthResult> {
  const session = await getSession()
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!can(session.user.role as Role, cap)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, session }
}

/** Authenticated but capability-agnostic — for routes open to any signed-in user. */
export async function authenticate(): Promise<AuthResult> {
  const session = await getSession()
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { ok: true, session }
}

/** 400 with the flattened zod error, matching the existing convention. */
export function validationError(details: unknown) {
  return NextResponse.json({ error: 'Validation failed', details }, { status: 400 })
}

export function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/**
 * 409 for optimistic-concurrency failures (spec §10.1). The caller sends the
 * `updatedAt` it loaded; a mismatch means someone else wrote in between.
 */
export function conflict(message: string, current?: unknown) {
  return NextResponse.json({ error: message, current }, { status: 409 })
}
