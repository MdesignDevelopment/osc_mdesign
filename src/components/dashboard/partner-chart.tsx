'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface PartnerChartProps {
  data: { name: string; count: number }[]
}

export function PartnerChart({ data }: PartnerChartProps) {
  return (
    <div className="jira-panel p-5">
      <p className="jira-section-header">By Partner</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} interval={0}
            angle={-35} textAnchor="end" height={55} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
          <Tooltip
            contentStyle={{ border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            cursor={{ fill: '#F8FAFC' }}
          />
          <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Requests" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
