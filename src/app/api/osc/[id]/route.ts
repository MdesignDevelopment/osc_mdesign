import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { oscRequestSchema } from '@/lib/validations'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const request = await prisma.oscRequest.findUnique({
    where: { id: params.id },
    include: {
      partner: true,
      createdBy: { select: { name: true } },
      comments: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
      history: { include: { user: { select: { name: true } } }, orderBy: { changedAt: 'asc' } },
    },
  })

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(request)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'EXTERN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await prisma.oscRequest.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = oscRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { receivedDate, updatedDate, oscRequestDate, mailSentDate, priority, ...rest } = parsed.data

  // Track changes for history
  const changes: Array<{ fieldChanged: string; oldValue: string | null; newValue: string | null }> = []
  const existingRec = existing as Record<string, unknown>
  const newRec: Record<string, unknown> = { ...rest, priority: priority ?? null }

  for (const field of ['status', 'priority', 'popzone', 'remark']) {
    const oldVal = String(existingRec[field] ?? '')
    const newVal = String(newRec[field] ?? '')
    if (oldVal !== newVal) {
      changes.push({ fieldChanged: field, oldValue: oldVal || null, newValue: newVal || null })
    }
  }

  const dateFields = [
    { key: 'receivedDate', val: receivedDate ? new Date(receivedDate) : null },
    { key: 'updatedDate', val: updatedDate ? new Date(updatedDate) : null },
    { key: 'oscRequestDate', val: oscRequestDate ? new Date(oscRequestDate) : null },
    { key: 'mailSentDate', val: mailSentDate ? new Date(mailSentDate) : null },
  ]

  for (const { key, val } of dateFields) {
    const oldDate = (existing as Record<string, unknown>)[key] as Date | null
    const oldStr = oldDate ? oldDate.toISOString().split('T')[0] : null
    const newStr = val ? val.toISOString().split('T')[0] : null
    if (oldStr !== newStr) {
      changes.push({ fieldChanged: key, oldValue: oldStr, newValue: newStr })
    }
  }

  const [updated] = await prisma.$transaction([
    prisma.oscRequest.update({
      where: { id: params.id },
      data: {
        ...rest,
        priority: priority ?? null,
        receivedDate: receivedDate ? new Date(receivedDate) : null,
        updatedDate: updatedDate ? new Date(updatedDate) : null,
        oscRequestDate: oscRequestDate ? new Date(oscRequestDate) : null,
        mailSentDate: mailSentDate ? new Date(mailSentDate) : null,
      },
    }),
    ...changes.map((change) =>
      prisma.oscHistory.create({
        data: {
          oscRequestId: params.id,
          userId: session.user.id,
          ...change,
        },
      })
    ),
  ])

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'EXTERN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const request = await prisma.oscRequest.findUnique({
    where: { id: params.id },
    include: { partner: { select: { name: true } } },
  })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { reason?: string }
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  await prisma.$transaction([
    prisma.oscHistory.create({
      data: {
        oscRequestId: params.id,
        userId: session.user.id,
        fieldChanged: 'deleted',
        oldValue: request.popzone,
        newValue: request.partner.name,
      },
    }),
    ...(reason ? [prisma.oscHistory.create({
      data: {
        oscRequestId: params.id,
        userId: session.user.id,
        fieldChanged: 'deleteReason',
        oldValue: null,
        newValue: reason,
      },
    })] : []),
    prisma.oscRequest.delete({ where: { id: params.id } }),
  ])

  return NextResponse.json({ success: true })
}
