'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, AlertTriangle, Lock } from 'lucide-react'
import {
  designSessionCreateSchema, designSessionUpdateSchema, isUnusualPopZone,
  type DesignSessionCreateInput,
} from '@/lib/validations'
import { DESIGN_STAGE_ORDER, DESIGN_STAGE_LABELS } from '@/lib/utils'

interface Props {
  mode: 'create' | 'edit'
  id?: string
  defaults?: Partial<DesignSessionCreateInput>
  updatedAt?: string
}

const FLAGS = [
  { key: 'sendOcRequestToPartner', label: 'Send OC Request to Partner' },
  { key: 'aapOnHold', label: 'AAP on Hold' },
  { key: 'readyToPost', label: 'Ready to Post' },
  { key: 'posted', label: 'Posted' },
] as const

export function DesignSessionForm({ mode, id, defaults, updatedAt }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const isEdit = mode === 'edit'

  const {
    register, handleSubmit, watch, formState: { errors },
  } = useForm<DesignSessionCreateInput>({
    resolver: zodResolver(isEdit ? designSessionUpdateSchema : designSessionCreateSchema),
    defaultValues: {
      popZone: defaults?.popZone ?? '',
      cabinetName: defaults?.cabinetName ?? '',
      mroPartner: defaults?.mroPartner ?? '',
      notes: defaults?.notes ?? '',
      actionsDone: defaults?.actionsDone ?? '',
      stage: defaults?.stage ?? 'IN_SESSION',
      sendOcRequestToPartner: defaults?.sendOcRequestToPartner ?? false,
      aapOnHold: defaults?.aapOnHold ?? false,
      readyToPost: defaults?.readyToPost ?? false,
      posted: defaults?.posted ?? false,
    },
  })

  const popZone = watch('popZone') ?? ''
  // Warn, never block: the naming convention is owned upstream (spec §10.2).
  const unusualPopZone = !isEdit && popZone.length > 2 && isUnusualPopZone(popZone)

  async function onSubmit(values: DesignSessionCreateInput) {
    setSubmitting(true)
    setError(null)
    setWarnings([])

    const payload = isEdit
      // popZone is intentionally not sent on edit — it is immutable (spec §6.1).
      ? { ...values, popZone: undefined, ...(updatedAt ? { expectedUpdatedAt: updatedAt } : {}) }
      : values

    const res = await fetch(
      isEdit ? `/api/design-sessions/${id}` : '/api/design-sessions',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )

    setSubmitting(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(
        res.status === 409 && !isEdit
          ? body?.error ?? 'A design session already exists for this POP zone.'
          : res.status === 409
            ? 'This session was changed by someone else while you were editing. Reload to see the latest.'
            : body?.error ?? 'Something went wrong.',
      )
      return
    }

    const saved = await res.json()
    router.push(`/design-sessions/${isEdit ? id : saved.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="jira-panel p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label={isEdit ? 'POP Zone' : 'POP Zone *'}
          error={errors.popZone?.message}
          htmlFor="popZone"
          hint={isEdit ? 'POP Zone cannot be changed after creation.' : 'e.g. MRO_HAALTERT_01_POP_011'}
        >
          <div className="relative">
            <input
              id="popZone"
              type="text"
              {...register('popZone')}
              disabled={isEdit}
              className="jira-input w-full font-mono text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {isEdit && (
              <Lock className="w-3.5 h-3.5 text-slate-300 absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
        </Field>

        <Field label="Cabinet Name" error={errors.cabinetName?.message} htmlFor="cabinetName" hint="e.g. H70CA03HA06">
          <input id="cabinetName" type="text" {...register('cabinetName')} className="jira-input w-full font-mono text-xs" />
        </Field>

        <Field label="MRO Partner" error={errors.mroPartner?.message} htmlFor="mroPartner" hint="e.g. ZTE">
          <input id="mroPartner" type="text" {...register('mroPartner')} className="jira-input w-full" />
        </Field>

        {/* Stage moves independently of the four flags below — it is not derived
            from them and setting one does not imply the other. */}
        <Field label="Stage" error={errors.stage?.message} htmlFor="stage">
          <select id="stage" {...register('stage')} className="jira-input w-full">
            {DESIGN_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{DESIGN_STAGE_LABELS[s]}</option>
            ))}
          </select>
        </Field>
      </div>

      {unusualPopZone && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            This does not look like the usual <span className="font-mono">MRO_&lt;CITY&gt;_&lt;NN&gt;_POP_&lt;NNN&gt;</span> format.
            You can still save it.
          </span>
        </div>
      )}

      <Field label="Notes" error={errors.notes?.message} htmlFor="notes">
        <textarea id="notes" {...register('notes')} rows={4} className="jira-input w-full resize-none" />
      </Field>

      <Field label="Actions Done" error={errors.actionsDone?.message} htmlFor="actionsDone">
        <textarea id="actionsDone" {...register('actionsDone')} rows={4} className="jira-input w-full resize-none" />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-slate-500 mb-1">Progress</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FLAGS.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                {...register(f.key)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500/20"
              />
              {f.label}
            </label>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          Marking a session as Posted also marks it Ready to Post.
        </p>
      </fieldset>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 space-y-0.5">
          {warnings.map((w) => <p key={w}>{w}</p>)}
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={submitting} className="jira-btn-primary text-xs">
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Session'}
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
