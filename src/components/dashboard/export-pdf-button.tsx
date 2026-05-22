'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

type PdfData = {
  generatedAt: string
  stats: {
    total: number
    updated: number
    highPrio: number
    checkRemarks: number
    weeklyCount: number
    avgOscDays: number
    avgMailDays: number
  }
  statusBreakdown: { label: string; count: number; pct: string }[]
  partnerBreakdown: { name: string; count: number; pct: string }[]
  requests: {
    popzone: string
    partner: string
    status: string
    priority: string
    remark: string
    receivedDate: string
    oscRequestDate: string
    mailSentDate: string
    updatedDate: string
    createdBy: string
    isHighPrio: boolean
  }[]
}

// RGB tuples used throughout the PDF
const C = {
  blue:      [37, 99, 235]   as [number, number, number],
  dark:      [15, 23, 42]    as [number, number, number],
  mid:       [100, 116, 139] as [number, number, number],
  lightBg:   [248, 250, 252] as [number, number, number],
  headerBg:  [30, 41, 59]    as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  redBg:     [254, 226, 226] as [number, number, number],
  redText:   [185, 28, 28]   as [number, number, number],
  border:    [226, 232, 240] as [number, number, number],
}

export function ExportPdfButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/pdf-data')
      if (!res.ok) throw new Error('Failed to fetch PDF data')
      const data: PdfData = await res.json()

      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()   // 297
      const pageH = doc.internal.pageSize.getHeight()  // 210
      const mL = 14
      const mR = 14
      const cW = pageW - mL - mR   // 269
      const genDate = new Date(data.generatedAt)

      // ── Blue header band ──────────────────────────────────────────
      doc.setFillColor(...C.blue)
      doc.rect(0, 0, pageW, 20, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...C.white)
      doc.text('OSC Tracker — Dashboard Report', mL, 13)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.text(`Generated: ${format(genDate, 'dd/MM/yyyy HH:mm')}`, pageW - mR, 10, { align: 'right' })
      doc.text(`Total records: ${data.stats.total}`, pageW - mR, 16, { align: 'right' })

      let y = 27

      // ── Helper: section label with separator line ─────────────────
      const sectionTitle = (title: string) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...C.mid)
        doc.text(title, mL, y)
        doc.setDrawColor(...C.border)
        doc.setLineWidth(0.25)
        const tw = doc.getTextWidth(title)
        doc.line(mL + tw + 3, y - 0.5, mL + cW, y - 0.5)
        y += 5
      }

      // ── KPI summary ───────────────────────────────────────────────
      sectionTitle('SUMMARY')

      autoTable(doc, {
        startY: y,
        body: [
          ['Total Requests',  String(data.stats.total),                  'OSC Updated',      String(data.stats.updated)],
          ['High Priority',   String(data.stats.highPrio),               'Check Remarks',    String(data.stats.checkRemarks)],
          ['Added This Week', String(data.stats.weeklyCount),            'Avg. OSC Days',    `${data.stats.avgOscDays} days`],
          ['Avg. Mail Days',  `${data.stats.avgMailDays} days`,          '',                 ''],
        ],
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 } },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: C.dark,  cellWidth: 65 },
          1: { fontStyle: 'bold', textColor: C.blue,  cellWidth: 30, halign: 'right' },
          2: { fontStyle: 'bold', textColor: C.dark,  cellWidth: 65 },
          3: { fontStyle: 'bold', textColor: C.blue,  cellWidth: 30, halign: 'right' },
        },
        alternateRowStyles: { fillColor: C.lightBg },
        margin: { left: mL, right: mR },
      })

      y = (doc as any).lastAutoTable.finalY + 8

      // ── Status + Partner side by side ─────────────────────────────
      const colMid = mL + cW * 0.47 + 4
      const halfW  = cW * 0.47

      sectionTitle('STATUS BREAKDOWN')
      const statusStartY = y

      autoTable(doc, {
        startY: statusStartY,
        head: [['Status', 'Count', '%']],
        body: data.statusBreakdown.map((s) => [s.label, String(s.count), s.pct]),
        theme: 'plain',
        headStyles: { fillColor: C.headerBg, textColor: C.white, fontStyle: 'bold', fontSize: 7.5, cellPadding: 3 },
        bodyStyles: { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 } },
        alternateRowStyles: { fillColor: C.lightBg },
        columnStyles: {
          0: { cellWidth: halfW - 42 },
          1: { cellWidth: 22, halign: 'right' },
          2: { cellWidth: 20, halign: 'right' },
        },
        margin: { left: mL, right: colMid },
      })

      const statusEndY = (doc as any).lastAutoTable.finalY

      // Partner title (right column — drawn at same Y as Status title)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...C.mid)
      doc.text('PARTNER BREAKDOWN', colMid, statusStartY - 5)
      doc.setDrawColor(...C.border)
      doc.setLineWidth(0.25)
      const ptw = doc.getTextWidth('PARTNER BREAKDOWN')
      doc.line(colMid + ptw + 3, statusStartY - 5.5, colMid + halfW, statusStartY - 5.5)

      autoTable(doc, {
        startY: statusStartY,
        head: [['Partner', 'Count', '%']],
        body: data.partnerBreakdown.map((p) => [p.name, String(p.count), p.pct]),
        theme: 'plain',
        headStyles: { fillColor: C.headerBg, textColor: C.white, fontStyle: 'bold', fontSize: 7.5, cellPadding: 3 },
        bodyStyles: { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 } },
        alternateRowStyles: { fillColor: C.lightBg },
        columnStyles: {
          0: { cellWidth: halfW - 42 },
          1: { cellWidth: 22, halign: 'right' },
          2: { cellWidth: 20, halign: 'right' },
        },
        margin: { left: colMid, right: mR },
      })

      y = Math.max(statusEndY, (doc as any).lastAutoTable.finalY) + 10

      // ── All Requests table ────────────────────────────────────────
      if (y > pageH - 45) { doc.addPage(); y = 15 }

      sectionTitle('ALL REQUESTS')

      autoTable(doc, {
        startY: y,
        head: [['Pop Zone', 'Partner', 'Status', 'Priority', 'Received', 'OSC Req.', 'Mail Sent', 'Updated', 'Created By']],
        body: data.requests.map((r) => [
          r.popzone,
          r.partner,
          r.status,
          r.priority,
          r.receivedDate,
          r.oscRequestDate,
          r.mailSentDate,
          r.updatedDate,
          r.createdBy,
        ]),
        theme: 'plain',
        headStyles: {
          fillColor: C.headerBg,
          textColor: C.white,
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 3,
        },
        bodyStyles: { fontSize: 7.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
        alternateRowStyles: { fillColor: C.lightBg },
        columnStyles: {
          0: { cellWidth: 32, fontStyle: 'bold' },
          1: { cellWidth: 36 },
          2: { cellWidth: 32 },
          3: { cellWidth: 28 },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 22, halign: 'center' },
          7: { cellWidth: 22, halign: 'center' },
          8: { cellWidth: 53 },
        },
        margin: { left: mL, right: mR },
        didParseCell: (hookData) => {
          if (hookData.section === 'body') {
            const req = data.requests[hookData.row.index]
            if (req?.isHighPrio) {
              hookData.cell.styles.fillColor = C.redBg
              hookData.cell.styles.textColor = C.redText
            }
          }
        },
      })

      // ── Page footers (added after all content so page count is final) ──
      const totalPages = doc.getNumberOfPages()
      const footerText = `OSC Tracker  ·  ${format(genDate, 'dd/MM/yyyy')}  ·  ${data.stats.total} records`
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text(`${footerText}  ·  Page ${i} of ${totalPages}`, pageW / 2, pageH - 5, { align: 'center' })
      }

      doc.save(`osc-dashboard-${format(genDate, 'yyyy-MM-dd')}.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {loading ? 'Generating…' : 'Export PDF'}
    </button>
  )
}
