import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, comment } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
  }

  if (typeof comment !== 'string' || comment.trim() === '') {
    return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
  }

  await prisma.oscComment.createMany({
    data: ids.map((id: string) => ({
      oscRequestId: id,
      userId: session.user.id,
      comment: comment.trim(),
    })),
  })

  return NextResponse.json({ created: ids.length })
}
