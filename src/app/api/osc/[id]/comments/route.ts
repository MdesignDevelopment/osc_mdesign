import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { commentSchema } from '@/lib/validations'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
