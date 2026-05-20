import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

const STATUS_LABELS: Record<string, string> = {
  OSC_UPDATED: 'OSC Updated',
  EMAIL_SENT: 'Email Sent',
  EMAIL_SENT_REMINDER: 'Email + Reminder',
  ON_HOLD: 'On Hold',
  CHECK_REMARKS: 'Check Remarks',
}

const PRIORITY_LABELS: Record<string, string> = {
  HIGH_PRIO: 'High Priority',
  MEDIUM_PRIO: 'Medium Priority',
  LOW_PRIO: 'Low Priority',
  NOT_DEFINED: 'Not defined',
}

function fmt(date: Date | null | undefined): string {
  if (!date) return ''
  return format(new Date(date), 'dd/MM/yyyy')
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const rows = requests.map((r) => ({
    'Pop Zone': r.popzone,
    'Partner': r.partner.name,
    'Status': STATUS_LABELS[r.status] ?? r.status,
    'Priority': r.priority ? (PRIORITY_LABELS[r.priority] ?? r.priority) : '',
    'Remark': r.remark ?? '',
    'Received Date': fmt(r.receivedDate),
    'OSC Request Date': fmt(r.oscRequestDate),
    'Mail Sent Date': fmt(r.mailSentDate),
    'Updated Date': fmt(r.updatedDate),
    'Created By': r.createdBy.name,
    'Created At': fmt(r.createdAt),
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 20 }, // Pop Zone
    { wch: 22 }, // Partner
    { wch: 20 }, // Status
    { wch: 16 }, // Priority
    { wch: 40 }, // Remark
    { wch: 16 }, // Received Date
    { wch: 18 }, // OSC Request Date
    { wch: 16 }, // Mail Sent Date
    { wch: 16 }, // Updated Date
    { wch: 20 }, // Created By
    { wch: 14 }, // Created At
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'OSC Requests')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `osc-requests-${format(new Date(), 'yyyy-MM-dd')}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Total-Exported': String(requests.length),
    },
  })
}
