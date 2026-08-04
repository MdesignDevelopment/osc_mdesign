import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/api-auth'
import { commentSchema } from '@/lib/validations'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Its own capability, not osc:read: commenting is a write to OSC data, so a
  // role granted read-only OSC visibility (WM_SUPPORT_ENGINEER) must not get it
  // for free. EXTERN reviewers keep it.
  const auth = await authorize('osc:comment')
  if (!auth.ok) return auth.response
  const { session } = auth

  const body = await req.json()
  const parsed = commentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const exists = await prisma.oscRequest.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const comment = await prisma.oscComment.create({
    data: {
      oscRequestId: params.id,
      userId: session.user.id,
      comment: parsed.data.comment,
    },
    include: { user: { select: { name: true, role: true } } },
  })

  return NextResponse.json(comment, { status: 201 })
}
