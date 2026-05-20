import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { commentSchema } from '@/lib/validations'

export async function PUT(req: NextRequest, { params }: { params: { id: string; commentId: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const comment = await prisma.oscComment.findUnique({ where: { id: params.commentId, oscRequestId: params.id } })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (comment.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = commentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const updated = await prisma.oscComment.update({
    where: { id: params.commentId },
    data: { comment: parsed.data.comment },
    include: { user: { select: { name: true, role: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; commentId: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const comment = await prisma.oscComment.findUnique({ where: { id: params.commentId } })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role !== 'ADMIN' && comment.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.oscComment.delete({ where: { id: params.commentId } })
  return NextResponse.json({ success: true })
}
