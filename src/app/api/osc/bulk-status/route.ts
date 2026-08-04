import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/api-auth'

const VALID_STATUSES = ['OSC_UPDATED', 'EMAIL_SENT', 'EMAIL_SENT_REMINDER', 'ON_HOLD', 'CHECK_REMARKS']

export async function POST(req: NextRequest) {
  const auth = await authorize('osc:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const { ids, status, remark } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
  }

  if (!status && typeof remark !== 'string') {
    return NextResponse.json({ error: 'No update fields provided' }, { status: 400 })
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}

  if (status) {
    updateData.status = status
    if (status === 'EMAIL_SENT' || status === 'EMAIL_SENT_REMINDER') {
      updateData.mailSentDate = new Date()
    }
  }

  if (typeof remark === 'string') {
    updateData.remark = remark
  }

  await prisma.oscRequest.updateMany({
    where: { id: { in: ids } },
    data: updateData,
  })

  return NextResponse.json({ updated: ids.length })
}
