import Link from 'next/link'
import { OscStatus } from '@prisma/client'
import { STATUS_LABELS, STATUS_LOZENGE } from '@/lib/utils'
import { Lozenge } from '@/components/ui/lozenge'

export interface OscStatusValue {
  status: OscStatus
  matchCount: number
  oscRequestId: string
}

/**
 * Read-only OSC Status projected from the OSC Tracker (spec §6.4).
 *
 * The match count is shown whenever a POP zone has more than one OSC request —
 * without it, a lone lozenge implies the zone has a single, unambiguous status,
 * which is false for ~4 in 5 zones in the current data.
 *
 * Drill-through is gated on osc:read so the caption never links into a module
 * the viewer cannot open. Every role that currently holds design:read also holds
 * osc:read, so the link renders — the guard remains for roles added later.
 */
export function OscStatusCell({
  value, popZone, canReadOsc, showCaption = true,
}: {
  value: OscStatusValue | null
  popZone: string
  canReadOsc: boolean
  showCaption?: boolean
}) {
  if (!value) {
    return (
      <span
        className="text-neutral-300 text-sm"
        title="No OSC request found for this POP zone"
      >
        —
      </span>
    )
  }

  const lozenge = (
    <Lozenge color={STATUS_LOZENGE[value.status]}>
      {STATUS_LABELS[value.status]}
    </Lozenge>
  )

  return (
    <div className="flex flex-col gap-0.5 items-start">
      {lozenge}
      {showCaption && value.matchCount > 1 && (
        canReadOsc ? (
          <Link
            href={`/osc?search=${encodeURIComponent(popZone)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-blue-600 hover:underline"
          >
            most recent of {value.matchCount} requests
          </Link>
        ) : (
          <span className="text-[10px] text-neutral-400">
            most recent of {value.matchCount} requests
          </span>
        )
      )}
    </div>
  )
}
