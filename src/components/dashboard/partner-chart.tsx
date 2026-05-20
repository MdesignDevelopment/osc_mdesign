'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface PartnerStackedEntry {
  name: string
  oscRequest: number
  received: number
  updated: number
}

interface PartnerChartProps {
  data: PartnerStackedEntry[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, p) => sum + p.value, 0)
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5 truncate max-w-[160px]">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-slate-500 flex-1">{p.name}</span>
          <span className="font-bold text-slate-900 tabular-nums">{p.value}</span>
        </div>
      ))}
      <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex justify-between">
        <span className="text-slate-400">Total</span>
        <span className="font-bold text-slate-900 tabular-nums">{total}</span>
      </div>
    </div>
  )
}

export function PartnerChart({ data }: PartnerChartProps) {
  const sorted = [...data]
    .sort(
      (a, b) =>
        b.oscRequest + b.received + b.updated - (a.oscRequest + a.received + a.updated),
    )
    .slice(0, 10)

  const height = Math.max(sorted.length * 44 + 60, 280)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 h-full flex flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Requests by Partner
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {sorted.length}
            <span className="text-sm font-medium text-slate-400 ml-2">top partners</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-shrink-0 mt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F97316]" />
            OSC Request
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
            Received
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            Updated
          </span>
        </div>
      </div>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 4 }}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#475569' }}
              width={90}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
            <Bar
              dataKey="oscRequest"
              name="OSC Request"
              stackId="a"
              fill="#F97316"
              radius={[3, 0, 0, 3]}
            />
            <Bar
              dataKey="received"
              name="Received"
              stackId="a"
              fill="#6366F1"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="updated"
              name="Updated"
              stackId="a"
              fill="#10B981"
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
