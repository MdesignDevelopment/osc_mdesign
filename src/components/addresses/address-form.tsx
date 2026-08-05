'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { addressRequestSchema, type AddressRequestInput } from '@/lib/validations'
import { ADDRESS_ACTION_LABELS, ADDRESS_ACTION_ORDER } from '@/lib/utils'

interface Props {
  mode: 'create' | 'edit'
  id?: string
  defaults?: Partial<AddressRequestInput>
  /** Sent back as a precondition so a concurrent edit 409s (spec §10.1). */
  updatedAt?: string
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function AddressForm({ mode, id, defaults, updatedAt }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register, handleSubmit, formState: { errors },
  } = useForm<AddressRequestInput>({
    resolver: zodResolver(addressRequestSchema),
    defaultValues: {
      requestDate: defaults?.requestDate ?? todayIso(),
      reporter: defaults?.reporter ?? '',
      popName: defaults?.popName ?? '',
      tinaUuid: defaults?.tinaUuid ?? '',
      aapId: defaults?.aapId ?? '',
      action: defaults?.action ?? 'OFF_HOLD',
      notes: defaults?.notes ?? '',
      completionDate: defaults?.completionDate ?? '',
    },
  })

  async function onSubmit(values: AddressRequestInput) {
    setSubmitting(true)
    setError(null)

    const res = await fetch(
      mode === 'create' ? '/api/addresses' : `/api/addresses/${id}`,
      {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          completionDate: values.completionDate || null,
          reporter: values.reporter || null,
          popName: values.popName || null,
          tinaUuid: values.tinaUuid || null,
          aapId: values.aapId || null,
          notes: values.notes || null,
          ...(updatedAt ? { expectedUpdatedAt: updatedAt } : {}),
        }),
      },
    )

    setSubmitting(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(
        res.status === 409
          ? 'This request was changed by someone else while you were editing. Reload to see the latest.'
          : body?.error ?? 'Something went wrong.',
      )
      return
    }

    const saved = await res.json()
    router.push(`/addresses/${mode === 'create' ? saved.id : id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="jira-panel p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Request Date *" error={errors.requestDate?.message} htmlFor="requestDate">
          <input id="requestDate" type="date" {...register('requestDate')} className="jira-input w-full" />
        </Field>

        <Field label="Reporter" error={errors.reporter?.message} htmlFor="reporter">
          <input id="reporter" type="text" {...register('reporter')} placeholder="Who reported it" className="jira-input w-full" />
        </Field>

        <Field label="POP Name" error={errors.popName?.message} htmlFor="popName">
          <input id="popName" type="text" {...register('popName')} placeholder="e.g. MRO_CITY_01_POP_001" className="jira-input w-full font-mono text-xs" />
        </Field>

        <Field
          label="Tina UUID"
          error={errors.tinaUuid?.message}
          htmlFor="tinaUuid"
          hint="Either a Tina UUID or an AAP ID is required."
        >
          <input id="tinaUuid" type="text" {...register('tinaUuid')} className="jira-input w-full font-mono text-xs" />
        </Field>

        <Field label="AAP ID" error={errors.aapId?.message} htmlFor="aapId">
          <input id="aapId" type="text" {...register('aapId')} className="jira-input w-full font-mono text-xs" />
        </Field>

        <Field label="Action *" error={errors.action?.message} htmlFor="action">
          <select id="action" {...register('action')} className="jira-input w-full">
            {ADDRESS_ACTION_ORDER.map((a) => (
              <option key={a} value={a}>{ADDRESS_ACTION_LABELS[a]}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Date of Completion"
          error={errors.completionDate?.message}
          htmlFor="completionDate"
          hint="Optional. Cannot precede the request date."
        >
          <input
            id="completionDate"
            type="date"
            {...register('completionDate')}
            className="jira-input w-full"
          />
        </Field>
      </div>

      <Field label="Notes" error={errors.notes?.message} htmlFor="notes">
        <textarea id="notes" {...register('notes')} rows={4} className="jira-input w-full resize-none" />
      </Field>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={submitting} className="jira-btn-primary text-xs">
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mode === 'create' ? 'Create Request' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.back()} className="jira-btn-secondary text-xs">
          Cancel
        </button>
      </div>
    </form>
  )
}

function Field({
  label, error, hint, htmlFor, children,
}: {
  label: string
  error?: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-500">{label}</label>
      {children}
      {hint && !error && <p className="text-[11px] text-slate-400">{hint}</p>}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
