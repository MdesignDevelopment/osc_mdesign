'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { oscRequestSchema, OscRequestInput } from '@/lib/validations'
import { Partner, OscRequest } from '@prisma/client'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface OscFormProps {
  partners: Partner[]
  initialData?: OscRequest | null
}

const STATUS_OPTIONS = [
  { value: 'OSC_UPDATED', label: 'OSC Updated' },
  { value: 'EMAIL_SENT', label: 'Email Sent' },
  { value: 'EMAIL_SENT_REMINDER', label: 'Email Sent + Reminder' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CHECK_REMARKS', label: 'Check Remarks' },
]

function toDateInput(val: Date | string | null | undefined): string {
  if (!val) return ''
  try { return format(new Date(val), 'yyyy-MM-dd') } catch { return '' }
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="jira-field-label block">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

export function OscForm({ partners, initialData }: OscFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initialData

  const { register, handleSubmit, formState: { errors } } = useForm<OscRequestInput>({
    resolver: zodResolver(oscRequestSchema),
    defaultValues: initialData
      ? {
          partnerId: initialData.partnerId,
          popzone: initialData.popzone,
          status: initialData.status,
          priority: initialData.priority ?? undefined,
          remark: initialData.remark ?? '',
          receivedDate: toDateInput(initialData.receivedDate),
          updatedDate: toDateInput(initialData.updatedDate),
          oscRequestDate: toDateInput(initialData.oscRequestDate),
          mailSentDate: toDateInput(initialData.mailSentDate),
        }
      : { status: 'ON_HOLD' },
  })

  const onSubmit = async (data: OscRequestInput) => {
    setLoading(true)
    setError(null)
    try {
      const url = isEdit ? `/api/osc/${initialData!.id}` : '/api/osc'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Something went wrong')
      }
      const result = await res.json()
      router.push(`/osc/${result.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="jira-panel p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Partner *" error={errors.partnerId?.message}>
            <select {...register('partnerId')} className="jira-input">
              <option value="">Select partner</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <Field label="PopZone *" error={errors.popzone?.message}>
            <input {...register('popzone')} type="text"
              placeholder="e.g. MRO_BRUGGE_04_POP_005" className="jira-input" />
          </Field>

          <Field label="Status *" error={errors.status?.message}>
            <select {...register('status')} className="jira-input">
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <Field label="Priority">
            <select {...register('priority')} className="jira-input">
              <option value="">No priority</option>
              <option value="HIGH_PRIO">High Priority</option>
              <option value="LOW_PRIO">Low Priority</option>
            </select>
          </Field>

          <Field label="Received Date">
            <input {...register('receivedDate')} type="date" className="jira-input" />
          </Field>

          <Field label="OSC Request Date">
            <input {...register('oscRequestDate')} type="date" className="jira-input" />
          </Field>

          <Field label="Mail Sent to Partner">
            <input {...register('mailSentDate')} type="date" className="jira-input" />
          </Field>

          <Field label="Updated Date">
            <input {...register('updatedDate')} type="date" className="jira-input" />
          </Field>
        </div>

        <Field label="Remark">
          <textarea {...register('remark')} rows={4}
            placeholder="Add remarks or notes..."
            className="jira-input resize-none" />
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button type="submit" disabled={loading} className="jira-btn-primary">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save changes' : 'Create request'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="text-sm text-blue-600 hover:underline px-1">
          Cancel
        </button>
      </div>
    </form>
  )
}
