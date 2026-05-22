'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { STATUS_LABELS } from '@/lib/utils'

interface StatusEntry { status: string; count: number }
interface PartnerEntry { name: string; oscRequest: number; received: number; updated: number; total: number }
interface ReportData {
  total: number
  byStatus: StatusEntry[]
  highPrio: number
  checkRemarks: number
  weeklyCount: number
  avgOscDays: number
  avgMailDays: number
  byPartnerStacked: PartnerEntry[]
  generatedAt: string
}

async function buildPdf(data: ReportData) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W = 210
  const M = 14
  const CW = W - M * 2

  const C = {
    dark:    [15,  23,  42]  as [number, number, number],
    blue:    [37,  99, 235]  as [number, number, number],
    text:    [30,  41,  59]  as [number, number, number],
    muted:   [100, 116, 139] as [number, number, number],
    light:   [248, 250, 252] as [number, number, number],
    border:  [226, 232, 240] as [number, number, number],
    white:   [255, 255, 255] as [number, number, number],
    slate4:  [148, 163, 184] as [number, number, number],
    red:     [220,  38,  38] as [number, number, number],
    cyan:    [8,  145, 178]  as [number, number, number],
    teal:    [13, 148, 136]  as [number, number, number],
  }

  const updated = data.byStatus.find((s) => s.status === 'OSC_UPDATED')?.count ?? 0
  const completionRate = data.total > 0 ? Math.round((updated / data.total) * 100) : 0
  const remaining = data.total - updated
  const actionRequired = data.highPrio + data.checkRemarks
  const genDate = new Date(data.generatedAt)

  // ── Header bar ──────────────────────────────────────────
  doc.setFillColor(...C.dark)
  doc.rect(0, 0, W, 22, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.white)
  doc.text('OSC Tracker Report', M, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.slate4)
  doc.text('M.Design Solutions', W - M, 10, { align: 'right' })
  doc.text(`Generated: ${format(genDate, 'dd/MM/yyyy HH:mm')}`, W - M, 17, { align: 'right' })

  let y = 30

  // ── Section label helper ─────────────────────────────────
  const sectionLabel = (label: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.muted)
    doc.text(label, M, y)
    y += 3
  }

  // ── Overall Progress ─────────────────────────────────────
  sectionLabel('OVERALL PROGRESS')

  doc.setFillColor(...C.light)
  doc.setDrawColor(...C.border)
  doc.roundedRect(M, y, CW, 26, 2, 2, 'FD')

  // Big completion %
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...C.dark)
  doc.text(`${completionRate}%`, M + 6, y + 15)

  // Stat boxes
  const stats = [
    { label: 'Total Requests', value: data.total.toString() },
    { label: 'Completed',      value: updated.toString() },
    { label: 'Remaining',      value: remaining.toString() },
    { label: 'Need Attention', value: actionRequired.toString(), warn: actionRequired > 0 },
  ]
  const statW = (CW - 42) / 4
  stats.forEach((stat, i) => {
    const x = M + 40 + i * (statW + 0.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...(stat.warn ? C.red : C.dark))
    doc.text(stat.value, x + statW / 2, y + 10, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...C.muted)
    doc.text(stat.label, x + statW / 2, y + 16, { align: 'center' })
  })

  // Progress bar
  const barX = M + 6
  const barY = y + 20
  const barW = CW - 12
  doc.setFillColor(...C.border)
  doc.roundedRect(barX, barY, barW, 2.5, 1, 1, 'F')
  if (completionRate > 0) {
    doc.setFillColor(...C.blue)
    doc.roundedRect(barX, barY, barW * (completionRate / 100), 2.5, 1, 1, 'F')
  }

  y += 33

  // ── Key Metrics ──────────────────────────────────────────
  sectionLabel('KEY METRICS')

  const metrics = [
    { label: 'High Priority',       value: data.highPrio.toString(),    unit: 'requests', color: C.red  },
    { label: 'New This Week',        value: data.weeklyCount.toString(), unit: 'requests', color: C.blue },
    { label: 'Avg OSC Processing',  value: data.avgOscDays.toString(),  unit: 'days',     color: C.cyan },
    { label: 'Avg Mail Response',   value: data.avgMailDays.toString(), unit: 'days',     color: C.teal },
  ]
  const mW = (CW - 4.5) / 4
  metrics.forEach((m, i) => {
    const x = M + i * (mW + 1.5)
    doc.setFillColor(...C.light)
    doc.setDrawColor(...C.border)
    doc.roundedRect(x, y, mW, 22, 2, 2, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...C.muted)
    doc.text(m.label.toUpperCase(), x + mW / 2, y + 5.5, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.setTextColor(...m.color)
    doc.text(m.value, x + mW / 2, y + 14, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...C.muted)
    doc.text(m.unit, x + mW / 2, y + 19, { align: 'center' })
  })

  y += 29

  // ── Status Breakdown ─────────────────────────────────────
  sectionLabel('STATUS BREAKDOWN')

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Status', 'Count', '% of Total']],
    body: data.byStatus.map((s) => [
      STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] ?? s.status,
      s.count.toString(),
      data.total > 0 ? `${Math.round((s.count / data.total) * 100)}%` : '0%',
    ]),
    headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 8, textColor: C.text, cellPadding: 3 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 52, halign: 'center' },
    },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9

  // ── Partner Breakdown ────────────────────────────────────
  sectionLabel('PARTNER BREAKDOWN')

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Partner', 'OSC Request', 'Received', 'Updated', 'Total']],
    body: data.byPartnerStacked.map((p) => [
      p.name,
      p.oscRequest.toString(),
      p.received.toString(),
      p.updated.toString(),
      p.total.toString(),
    ]),
    headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 8, textColor: C.text, cellPadding: 3 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 28, halign: 'center' },
      4: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
    },
  })

  // ── Footer on every page ─────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.slate4)
    doc.text('Confidential — M.Design Solutions', M, 292)
    doc.text(`Page ${i} of ${pageCount}`, W / 2, 292, { align: 'center' })
    doc.text(format(genDate, 'dd/MM/yyyy'), W - M, 292, { align: 'right' })
  }

  doc.save(`osc-report-${format(genDate, 'yyyy-MM-dd')}.pdf`)
}

export function ExportPdfButton() {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/report-data')
      if (!res.ok) throw new Error('Failed to fetch report data')
      const data: ReportData = await res.json()
      await buildPdf(data)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Download className="w-3.5 h-3.5" />}
      Export PDF
    </button>
  )
}
