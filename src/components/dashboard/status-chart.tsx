'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { OscStatus } from '@prisma/client'
import { STATUS_LABELS } from '@/lib/utils'

const COLORS: Record<OscStatus, string> = {
  OSC_UPDATED: '#10B981',
  EMAIL_SENT: '#3B82F6',
  EMAIL_SENT_REMINDER: '#F59E0B',
  ON_HOLD: '#94A3B8',
  CHECK_REMARKS: '#F87171',
}

interface StatusChartProps {
  data: { status: OscStatus; count: number }[]
}

export function StatusChart({ data }: StatusChartProps) {
  const chartData = data.map((d) => ({
    name: STATUS_LABELS[d.status],
    value: d.count,
    color: COLORS[d.status],
  }))

  return (
    <div className="jira-panel p-5">
      <p className="jira-section-header">Status Breakdown</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
            paddingAngle={2} dataKey="value">
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            formatter={(value) => [value, 'Count']}
          />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', color: '#64748B' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
