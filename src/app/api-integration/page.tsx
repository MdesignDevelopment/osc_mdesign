import { getTodayApiKey, getKeyValidUntil } from '@/lib/api-key'
import { ApiIntegrationClient } from '@/components/api-integration/api-integration-client'

export const dynamic = 'force-dynamic'

export default function ApiIntegrationPage() {
  const apiKey = getTodayApiKey()
  const validUntil = getKeyValidUntil().toISOString()

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">API Integration</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Load OSC request data into Excel, Power BI, or any other tool via the data API
        </p>
      </div>
      <ApiIntegrationClient apiKey={apiKey} validUntil={validUntil} />
    </div>
  )
}
