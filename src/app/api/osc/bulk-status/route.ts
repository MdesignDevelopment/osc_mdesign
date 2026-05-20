import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const VALID_STATUSES = ['OSC_UPDATED', 'EMAIL_SENT', 'EMAIL_SENT_REMINDER', 'ON_HOLD', 'CHECK_REMARKS']

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'EXTERN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ids, status } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { status }

  if (status === 'EMAIL_SENT' || status === 'EMAIL_SENT_REMINDER') {
    updateData.mailSentDate = new Date()
  }

  await prisma.oscRequest.updateMany({
    where: { id: { in: ids } },
    data: updateData,
  })

  return NextResponse.json({ updated: ids.length })
}
