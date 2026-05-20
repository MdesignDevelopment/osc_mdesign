'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { STATUS_LABELS } from '@/lib/utils'

type OscStatus = 'OSC_UPDATED' | 'EMAIL_SENT' | 'EMAIL_SENT_REMINDER' | 'ON_HOLD' | 'CHECK_REMARKS'

const STATUS_COLORS: Record<OscStatus, string> = {
  OSC_UPDATED: '#10B981',
  EMAIL_SENT: '#6366F1',
  EMAIL_SENT_REMINDER: '#F59E0B',
  ON_HOLD: '#94A3B8',
  CHECK_REMARKS: '#F43F5E',
}

interface StatusChartProps {
  data: { status: OscStatus; count: number }[]
  total: number
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number; payload: { pct: number; fill: string } }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: item.payload.fill }}
        />
        <p className="font-semibold text-slate-700">{item.name}</p>
      </div>
      <p className="text-slate-900 font-bold">
        {item.value.toLocaleString()}{' '}
        <span className="text-slate-400 font-normal">requests</span>
      </p>
      <p className="text-slate-400 mt-0.5">{item.payload.pct}% of total</p>
    </div>
  )
}

export function StatusChart({ data, total }: StatusChartProps) {
  const chartData = [...data]
    .sort((a, b) => b.count - a.count)
    .map((d) => ({
      status: d.status,
      name: STATUS_LABELS[d.status],
      value: d.count,
      fill: STATUS_COLORS[d.status],
      pct: total > 0 ? Math.round((d.count / total) * 100) : 0,
    }))

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 h-full flex flex-col">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Status Distribution
        </p>
        <p className="text-2xl font-bold text-slate-900 mt-1">
          {total.toLocaleString()}
          <span className="text-sm font-medium text-slate-400 ml-2">total requests</span>
        </p>
      </div>

      {/* Donut chart with center overlay */}
      <div className="relative flex-1" style={{ minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="56%"
              outerRadius="80%"
              dataKey="value"
              strokeWidth={2}
              stroke="#fff"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
            {total.toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 font-medium">requests</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2 pt-4 border-t border-slate-50 mt-2">
        {chartData.map((item) => (
          <div key={item.status} className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.fill }}
            />
            <span className="text-xs text-slate-600 flex-1 truncate">{item.name}</span>
            <span className="text-xs font-bold text-slate-900 tabular-nums">
              {item.value.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 w-8 text-right tabular-nums">
              {item.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
