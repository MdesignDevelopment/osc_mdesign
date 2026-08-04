import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorize } from '@/lib/api-auth'
import { oscRequestSchema } from '@/lib/validations'
import { Prisma, OscStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  const auth = await authorize('osc:read')
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25'))

  const VALID_STATUSES = ['OSC_UPDATED', 'EMAIL_SENT', 'EMAIL_SENT_REMINDER', 'ON_HOLD', 'CHECK_REMARKS'] as const
  const rawStatus = searchParams.get('status')
  const status = rawStatus && (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus as OscStatus : null

  const VALID_PRIORITIES = ['HIGH_PRIO', 'MEDIUM_PRIO', 'LOW_PRIO', 'NOT_DEFINED'] as const
  const rawPriority = searchParams.get('priority')
  const priority = rawPriority && (VALID_PRIORITIES as readonly string[]).includes(rawPriority) ? rawPriority : null

  const partner = searchParams.get('partner')
  const search = searchParams.get('search')

  const where: Prisma.OscRequestWhereInput = {
    ...(status && { status }),
    ...(priority && { priority: priority as import('@prisma/client').Priority }),
    ...(partner && { partnerId: partner }),
    ...(search && {
      OR: [
        { popzone: { contains: search, mode: 'insensitive' } },
        { partner: { name: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    prisma.oscRequest.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { partner: true },
    }),
    prisma.oscRequest.count({ where }),
  ])

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(req: NextRequest) {
  const auth = await authorize('osc:write')
  if (!auth.ok) return auth.response
  const { session } = auth

  const body = await req.json()
  const parsed = oscRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { receivedDate, updatedDate, oscRequestDate, mailSentDate, priority, ...rest } = parsed.data

  const request = await prisma.oscRequest.create({
    data: {
      ...rest,
      priority: priority ?? null,
      receivedDate: receivedDate ? new Date(receivedDate) : null,
      updatedDate: updatedDate ? new Date(updatedDate) : null,
      oscRequestDate: oscRequestDate ? new Date(oscRequestDate) : null,
      mailSentDate: mailSentDate ? new Date(mailSentDate) : null,
      createdById: session.user.id,
    },
  })

  return NextResponse.json(request, { status: 201 })
}
