'use client'

import { useState, useEffect } from 'react'
import { X, Mail, Copy, Check, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

type Lang = 'EN' | 'NL' | 'FR'
type MailType = 'first_time' | 'reminder'

export interface MailPresetRow {
  id: string
  popzone: string
  priority: string | null
  oscRequestDate: Date | string | null
}

// Group popzones by their MRO_..._POP prefix, comma-separating the numbers
function groupPopzones(popzones: string[]): string {
  const groups = new Map<string, string[]>()
  for (const pz of popzones) {
    const match = pz.match(/^(.+_POP)_(\d+.*)$/)
    if (match) {
      const prefix = match[1]
      const num = match[2]
      if (!groups.has(prefix)) groups.set(prefix, [])
      groups.get(prefix)!.push(num)
    } else {
      if (!groups.has(pz)) groups.set(pz, [])
    }
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, nums]) => {
      if (nums.length === 0) return prefix
      const sorted = [...nums].sort()
      return `${prefix}_${sorted[0]}${sorted.length > 1 ? ', ' + sorted.slice(1).join(', ') : ''}`
    })
    .join('\n')
}

function getEarliestDate(rows: MailPresetRow[]): string {
  const dates = rows
    .map((r) => r.oscRequestDate)
    .filter(Boolean)
    .map((d) => new Date(d as Date))
    .sort((a, b) => a.getTime() - b.getTime())
  return dates.length > 0 ? format(dates[0], 'dd/MM/yyyy') : '[DATE]'
}

const LABELS: Record<Lang, {
  greeting: string
  firstIntro: string
  reminderIntro: string
  p1: string
  std: string
  requiredBefore: string
  footer: string
  sign: string
}> = {
  EN: {
    greeting: 'Dear,',
    firstIntro: 'I hope this message finds you well.\nWe kindly request OSC updates (planned / constructed) for the following POP zones, organized by priority and deadline:',
    reminderIntro: 'I hope this message finds you well.\nThis is a reminder regarding our previous request for OSC updates for the following POP zones:',
    p1: 'PRIORITY 1',
    std: 'STANDARD PRIORITY',
    requiredBefore: 'Required before',
    footer: 'Please confirm receipt of this request and let us know if you have any questions or require additional information.\n\nThank you for your cooperation.',
    sign: 'Kind regards,\n[Name]\nLLD Support Team',
  },
  NL: {
    greeting: 'Geachte,',
    firstIntro: 'Ik hoop dat u dit bericht in goede gezondheid ontvangt.\nWij verzoeken vriendelijk om OSC-updates (gepland / gebouwd) voor de volgende POP-zones, geordend op prioriteit en deadline:',
    reminderIntro: 'Ik hoop dat u dit bericht in goede gezondheid ontvangt.\nDit is een herinnering aan ons eerder verzoek voor OSC-updates voor de volgende POP-zones:',
    p1: 'PRIORITEIT 1',
    std: 'STANDAARD PRIORITEIT',
    requiredBefore: 'Vereist vóór',
    footer: 'Gelieve ontvangst van dit verzoek te bevestigen en ons te laten weten indien u vragen heeft of aanvullende informatie nodig heeft.\n\nBedankt voor uw medewerking.',
    sign: 'Met vriendelijke groeten,\n[Naam]\nLLD Support Team',
  },
  FR: {
    greeting: 'Madame, Monsieur,',
    firstIntro: "J'espère que ce message vous trouve en bonne santé.\nNous vous demandons aimablement des mises à jour OSC (planifiées / construites) pour les zones POP suivantes, organisées par priorité et échéance :",
    reminderIntro: "J'espère que ce message vous trouve en bonne santé.\nCeci est un rappel concernant notre demande précédente de mises à jour OSC pour les zones POP suivantes :",
    footer: "Veuillez confirmer la réception de cette demande et nous informer si vous avez des questions ou besoin d'informations supplémentaires.\n\nMerci de votre coopération.",
    p1: 'PRIORITÉ 1',
    std: 'PRIORITÉ STANDARD',
    requiredBefore: 'Requis avant',
    sign: 'Cordialement,\n[Nom]\nLLD Support Team',
  },
}

function buildMailText(rows: MailPresetRow[], lang: Lang, type: MailType): string {
  const l = LABELS[lang]
  const intro = type === 'first_time' ? l.firstIntro : l.reminderIntro

  const highRows = rows.filter((r) => r.priority === 'HIGH_PRIO')
  const stdRows = rows.filter((r) => r.priority !== 'HIGH_PRIO')

  const sections: string[] = []
  if (highRows.length > 0) {
    const date = getEarliestDate(highRows)
    sections.push(`${l.p1} - ${l.requiredBefore} ${date}:\n${groupPopzones(highRows.map((r) => r.popzone))}`)
  }
  if (stdRows.length > 0) {
    const date = getEarliestDate(stdRows)
    sections.push(`${l.std} - ${l.requiredBefore} ${date}:\n${groupPopzones(stdRows.map((r) => r.popzone))}`)
  }

  return `${l.greeting}\n\n${intro}\n\n${sections.join('\n\n')}\n\n${l.footer}\n\n${l.sign}`
}

interface MailPresetDialogProps {
  open: boolean
  selectedRows: MailPresetRow[]
  canEdit: boolean
  onClose: () => void
  onRefresh: () => void
}

export function MailPresetDialog({ open, selectedRows, canEdit, onClose, onRefresh }: MailPresetDialogProps) {
  const [lang, setLang] = useState<Lang>('EN')
  const [mailType, setMailType] = useState<MailType>('first_time')
  const [mailText, setMailText] = useState('')
  const [copied, setCopied] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updated, setUpdated] = useState(false)

  const reset = () => setMailText(buildMailText(selectedRows, lang, mailType))

  useEffect(() => {
    if (open) {
      setCopied(false)
      setShowConfirm(false)
      setUpdated(false)
    }
  }, [open])

  useEffect(() => {
    reset()
    setCopied(false)
    setShowConfirm(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, mailType, selectedRows])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mailText)
    setCopied(true)
    if (canEdit) setShowConfirm(true)
  }

  const handleUpdateStatus = async () => {
    setUpdating(true)
    const status = mailType === 'first_time' ? 'EMAIL_SENT' : 'EMAIL_SENT_REMINDER'
    await fetch('/api/osc/bulk-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedRows.map((r) => r.id), status }),
    })
    setUpdating(false)
    setUpdated(true)
    setShowConfirm(false)
    onRefresh()
  }

  if (!open) return null

  const targetStatus = mailType === 'first_time' ? 'Email Sent' : 'Email + Reminder'
  const count = selectedRows.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-neutral-200 dark:border-white/10 w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Mail Preset</h2>
            <span className="text-xs bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded-full tabular-nums">
              {count} popzone{count !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-white/8 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-shrink-0 flex-wrap">
          {/* Language */}
          <div className="flex gap-0.5 p-1 bg-neutral-100 dark:bg-[#222] rounded-lg">
            {(['EN', 'NL', 'FR'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all',
                  lang === l
                    ? 'bg-white dark:bg-[#2a2a2a] text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Type */}
          <div className="flex gap-0.5 p-1 bg-neutral-100 dark:bg-[#222] rounded-lg">
            {([['first_time', 'First Time'], ['reminder', 'Reminder']] as [MailType, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setMailType(t)}
                className={cn(
                  'px-3.5 py-1 rounded-md text-xs font-medium transition-all',
                  mailType === t
                    ? t === 'first_time'
                      ? 'bg-white dark:bg-[#2a2a2a] text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'bg-white dark:bg-[#2a2a2a] text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="px-5 pb-3 flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
          <textarea
            value={mailText}
            onChange={(e) => setMailText(e.target.value)}
            className="flex-1 min-h-[260px] w-full text-sm font-mono bg-neutral-50 dark:bg-[#111] border border-neutral-200 dark:border-white/10 rounded-lg px-3.5 py-3 text-neutral-800 dark:text-neutral-200 resize-none outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all leading-relaxed"
          />

          {/* Status update confirm */}
          {showConfirm && !updated && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg px-4 py-3 flex-shrink-0">
              <p className="text-xs text-blue-800 dark:text-blue-300 mb-2.5">
                Update status to{' '}
                <span className="font-semibold">&quot;{targetStatus}&quot;</span> for {count} popzone
                {count !== 1 ? 's' : ''}?
                <span className="ml-1 opacity-70">(Mail Sent date will be set to today)</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateStatus}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-60"
                >
                  {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Yes, update
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {updated && (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs flex-shrink-0">
              <Check className="w-3.5 h-3.5" />
              Status updated to &quot;{targetStatus}&quot; for {count} popzone{count !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-100 dark:border-white/8 flex items-center justify-between flex-shrink-0">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              copied
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                : 'bg-blue-600 hover:bg-blue-700 text-white',
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Mail'}
          </button>
        </div>
      </div>
    </div>
  )
}
