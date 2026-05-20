'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { subDays, format } from 'date-fns'
import { cn } from '@/lib/utils'

interface MailTrendEntry {
  receivedDate: string | null
  mailSentDate: string | null
  partnerName: string
}

interface MailTrendChartProps {
  data: MailTrendEntry[]
  partners: string[]
}

const PERIODS = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: 'All', value: 0 },
]

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
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-slate-500 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500 flex-1">{p.name}</span>
          <span className="font-bold text-slate-900 tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function MailTrendChart({ data, partners }: MailTrendChartProps) {
  const [period, setPeriod] = useState(30)
  const [selectedPartner, setSelectedPartner] = useState('all')

  const chartData = useMemo(() => {
    const cutoff = period > 0 ? subDays(new Date(), period) : new Date(0)
    const filtered =
      selectedPartner === 'all' ? data : data.filter((d) => d.partnerName === selectedPartner)

    const dateMap: Record<string, { mailSent: number; received: number }> = {}

    for (const item of filtered) {
      if (item.mailSentDate) {
        const dt = new Date(item.mailSentDate)
        if (dt >= cutoff) {
          const key = format(dt, 'yyyy-MM-dd')
          if (!dateMap[key]) dateMap[key] = { mailSent: 0, received: 0 }
          dateMap[key].mailSent++
        }
      }
      if (item.receivedDate) {
        const dt = new Date(item.receivedDate)
        if (dt >= cutoff) {
          const key = format(dt, 'yyyy-MM-dd')
          if (!dateMap[key]) dateMap[key] = { mailSent: 0, received: 0 }
          dateMap[key].received++
        }
      }
    }

    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date: format(new Date(date + 'T00:00:00'), 'MMM d'),
        ...counts,
      }))
  }, [data, period, selectedPartner])

  const totalSent = chartData.reduce((sum, d) => sum + d.mailSent, 0)
  const totalReceived = chartData.reduce((sum, d) => sum + d.received, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Mail Activity
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {(totalSent + totalReceived).toLocaleString()}
            <span className="text-sm font-medium text-slate-400 ml-2">events in period</span>
          </p>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
              <span className="text-xs text-slate-500">
                <span className="font-bold text-slate-800 tabular-nums">{totalSent}</span> sent
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-xs text-slate-500">
                <span className="font-bold text-slate-800 tabular-nums">{totalReceived}</span> received
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedPartner}
            onChange={(e) => setSelectedPartner(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 hover:border-slate-300 transition-colors"
          >
            <option value="all">All Partners</option>
            {partners.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {PERIODS.map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setPeriod(value)}
                className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded-md transition-colors',
                  period === value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center gap-2 text-slate-400">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
            <span className="text-xl">📭</span>
          </div>
          <p className="text-sm font-medium">No data for the selected period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gradMailSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="mailSent"
              name="Mail Sent"
              stroke="#6366F1"
              strokeWidth={2}
              fill="url(#gradMailSent)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="received"
              name="Received"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#gradReceived)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
