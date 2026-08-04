import { NextRequest } from 'next/server'
import { patchDesignSession } from '@/lib/design-session-write'

// Inline boolean toggles from the list view (spec §6.3). Kept as its own path
// for API consumers that only ever touch flags; the implementation is the same
// partial write PATCH /api/design-sessions/[id] uses, so the lifecycle rules and
// the audit trail cannot drift between the two.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return patchDesignSession(req, params.id)
}
