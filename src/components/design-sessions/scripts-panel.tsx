'use client'

import { useState, Fragment } from 'react'
import { ScriptStatus } from '@prisma/client'
import { Terminal, ChevronRight, ChevronDown } from 'lucide-react'
import { cn, formatDateTime, SCRIPT_STATUS_LABELS, SCRIPT_STATUS_LOZENGE } from '@/lib/utils'
import { Lozenge } from '@/components/ui/lozenge'

export interface ScriptRow {
  id: string
  scriptName: string
  scriptVersion: string | null
  status: ScriptStatus
  executedAt: string
  durationMs: number | null
  output: string | null
  executedByLabel: string | null
  executedByName: string | null
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.round((ms % 60_000) / 1000)
  return `${mins}m ${secs}s`
}

/**
 * Script executions recorded against this POP zone (spec §6.5).
 *
 * Read-only for every role: executions are ingested events, never hand-edited,
 * which is also why they carry no audit trail of their own. Capped at the 50
 * most recent by the server so a heavily scripted zone cannot blow up the page.
 */
export function ScriptsPanel({
  scripts, popZone, truncated,
}: {
  scripts: ScriptRow[]
  popZone: string
  truncated: boolean
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  return (
    <div className="jira-panel">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <p className="jira-section-header">Scripts</p>
        <span className="text-xs text-slate-400 tabular-nums">
          {scripts.length}{truncated ? '+' : ''} execution{scripts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {scripts.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 mb-2">
            <Terminal className="w-4 h-4 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">No script executions recorded</p>
          <p className="text-xs text-slate-400 mt-1">
            Runs reported for <span className="font-mono">{popZone}</span> will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="jira-table-header w-8" />
                <th className="jira-table-header">Script</th>
                <th className="jira-table-header">Status</th>
                <th className="jira-table-header">Executed</th>
                <th className="jira-table-header text-right">Duration</th>
                <th className="jira-table-header">By</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((s) => {
                const isOpen = expanded[s.id]
                const hasOutput = Boolean(s.output)

                return (
                  <Fragment key={s.id}>
                    <tr
                      className={cn('jira-table-row', hasOutput && 'cursor-pointer')}
                      onClick={() => hasOutput && setExpanded((e) => ({ ...e, [s.id]: !e[s.id] }))}
                    >
                      <td className="jira-table-cell">
                        {hasOutput && (
                          <button
                            aria-label={isOpen ? 'Hide output' : 'Show output'}
                            aria-expanded={isOpen}
                            className="text-slate-300 hover:text-slate-600"
                          >
                            {isOpen
                              ? <ChevronDown className="w-3.5 h-3.5" />
                              : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </td>
                      <td className="jira-table-cell">
                        <span className="font-mono text-xs text-slate-800">{s.scriptName}</span>
                        {s.scriptVersion && (
                          <span className="ml-1.5 text-[10px] text-slate-400">v{s.scriptVersion}</span>
                        )}
                      </td>
                      <td className="jira-table-cell">
                        <Lozenge color={SCRIPT_STATUS_LOZENGE[s.status]}>
                          {SCRIPT_STATUS_LABELS[s.status]}
                        </Lozenge>
                      </td>
                      <td className="jira-table-cell tabular-nums whitespace-nowrap text-slate-500">
                        {formatDateTime(s.executedAt)}
                      </td>
                      <td className="jira-table-cell text-right tabular-nums text-slate-500">
                        {formatDuration(s.durationMs)}
                      </td>
                      <td className="jira-table-cell text-slate-500">
                        {s.executedByName ?? s.executedByLabel ?? '—'}
                      </td>
                    </tr>

                    {isOpen && hasOutput && (
                      <tr>
                        <td colSpan={6} className="px-4 pb-3 pt-0 bg-slate-50/60">
                          <pre className="text-[11px] font-mono text-slate-600 whitespace-pre-wrap max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg p-3">
                            {s.output}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {truncated && (
            <p className="px-4 py-2.5 text-[11px] text-slate-400 border-t border-slate-100">
              Showing the 50 most recent executions.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
