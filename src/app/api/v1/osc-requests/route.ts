import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateApiKey } from '@/lib/api-key'
import { STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// External data API — returns all OSC requests as flat JSON, designed to be
// consumed by Excel Power Query. Authenticated with the daily-rotating API
// key (X-API-Key header or ?api_key= query parameter), not a user session.

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('api_key')

  if (!validateApiKey(key)) {
    return NextResponse.json(
      {
        error:
          'Invalid or expired API key. Keys rotate daily at midnight UTC — copy the current key from the API Integration page in the OSC Tracker app.',
      },
      { status: 401 }
    )
  }

  const requests = await prisma.oscRequest.findMany({
    orderBy: [
      { priority: { sort: 'asc', nulls: 'last' } },
      { receivedDate: { sort: 'desc', nulls: 'last' } },
    ],
    include: {
      partner: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  })

  const data = requests.map((r) => ({
    id: r.id,
    popZone: r.popzone,
    partner: r.partner.name,
    status: STATUS_LABELS[r.status] ?? r.status,
    statusCode: r.status,
    priority: r.priority ? (PRIORITY_LABELS[r.priority] ?? r.priority) : null,
    priorityCode: r.priority,
    remark: r.remark,
    oscRequestDate: r.oscRequestDate?.toISOString() ?? null,
    mailSentDate: r.mailSentDate?.toISOString() ?? null,
    receivedDate: r.receivedDate?.toISOString() ?? null,
    updatedDate: r.updatedDate?.toISOString() ?? null,
    createdBy: r.createdBy.name,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: data.length,
    data,
  })
}
