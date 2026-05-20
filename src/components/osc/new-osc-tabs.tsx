'use client'

import { useState } from 'react'
import { Partner } from '@prisma/client'
import { OscForm } from './osc-form'
import { BulkUploadForm } from './bulk-upload-form'

const TABS = [
  { id: 'single', label: 'Single Entry' },
  { id: 'bulk', label: 'Bulk Upload' },
] as const

type TabId = (typeof TABS)[number]['id']

interface NewOscTabsProps {
  partners: Partner[]
}

export function NewOscTabs({ partners }: NewOscTabsProps) {
  const [active, setActive] = useState<TabId>('single')

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'single' && <OscForm partners={partners} />}
      {active === 'bulk' && <BulkUploadForm />}
    </div>
  )
}
