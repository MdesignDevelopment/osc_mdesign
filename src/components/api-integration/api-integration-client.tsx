'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Eye, EyeOff, KeyRound, RefreshCw, Table2, AlertTriangle } from 'lucide-react'

interface ApiIntegrationClientProps {
  apiKey: string
  validUntil: string // ISO string, next midnight UTC
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="jira-btn-secondary !px-2.5 !py-1.5 text-xs flex-shrink-0"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : (label ?? 'Copy')}
    </button>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2 opacity-70 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
    </div>
  )
}

const RESPONSE_FIELDS: Array<[string, string, string]> = [
  ['popZone', 'Text', 'POP zone identifier'],
  ['partner', 'Text', 'Partner name'],
  ['status', 'Text', 'Status label (e.g. "On Hold", "Email Sent")'],
  ['priority', 'Text', 'Priority label (e.g. "High Priority"), empty if not set'],
  ['remark', 'Text', 'Free-text remark, empty if not set'],
  ['oscRequestDate', 'Date/time (ISO 8601)', 'OSC request submission date'],
  ['mailSentDate', 'Date/time (ISO 8601)', 'When the email was sent'],
  ['receivedDate', 'Date/time (ISO 8601)', 'When the request was received'],
  ['updatedDate', 'Date/time (ISO 8601)', 'Last update date'],
  ['createdBy', 'Text', 'Name of the user who created the request'],
  ['createdAt', 'Date/time (ISO 8601)', 'When the record was created in the app'],
]

export function ApiIntegrationClient({ apiKey, validUntil }: ApiIntegrationClientProps) {
  const [showKey, setShowKey] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin('https://osc.mdesignsolutions.ma')
  }, [])

  const baseUrl = origin || 'https://osc.mdesignsolutions.ma'
  const endpointUrl = `${baseUrl}/api/v1/osc-requests`
  const urlWithKey = `${endpointUrl}?api_key=${apiKey}`
  const maskedKey = apiKey.slice(0, 8) + '•'.repeat(24) + apiKey.slice(-4)

  const validUntilDate = new Date(validUntil)
  const validUntilLabel = validUntilDate.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const powerQueryCode = `let
    // 1. Paste today's API key here (rotates daily — see the API Integration page)
    ApiKey = "API_KEY_HERE",
    BaseUrl = "${baseUrl}",

    Source = Json.Document(
        Web.Contents(BaseUrl & "/api/v1/osc-requests", [Headers = [#"X-API-Key" = ApiKey]])
    ),
    Records = Source[data],
    AsTable = Table.FromList(Records, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Expanded = Table.ExpandRecordColumn(
        AsTable, "Column1",
        {"popZone", "partner", "status", "priority", "remark", "oscRequestDate",
         "mailSentDate", "receivedDate", "updatedDate", "createdBy", "createdAt"},
        {"Pop Zone", "Partner", "Status", "Priority", "Remark", "OSC Request Date",
         "Mail Sent Date", "Received Date", "Updated Date", "Created By", "Created At"}
    ),
    Typed = Table.TransformColumnTypes(Expanded, {
        {"OSC Request Date", type datetimezone}, {"Mail Sent Date", type datetimezone},
        {"Received Date", type datetimezone}, {"Updated Date", type datetimezone},
        {"Created At", type datetimezone}
    })
in
    Typed`

  const curlExample = `curl -H "X-API-Key: API_KEY_HERE" \\
  ${endpointUrl}`

  return (
    <div className="space-y-4">
      {/* ── Today's API key ── */}
      <section className="jira-panel p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Today&apos;s API Key</h2>
        </div>

        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800">
            {showKey ? apiKey : maskedKey}
          </code>
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="jira-btn-secondary !px-2.5 !py-1.5"
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <CopyButton text={apiKey} label="Copy key" />
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p>
            This key rotates automatically <strong>every day at midnight UTC</strong>. The current key is valid
            until <strong>{validUntilLabel}</strong> (your local time). When a refresh fails with a 401 error,
            come back to this page, copy the new key, and update it in your workbook.
          </p>
        </div>
      </section>

      {/* ── Endpoint reference ── */}
      <section className="jira-panel p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Endpoint</h2>

        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 text-[11px] font-bold tracking-wide bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 rounded px-2 py-1">
            GET
          </span>
          <code className="flex-1 min-w-0 truncate bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800">
            {endpointUrl}
          </code>
          <CopyButton text={endpointUrl} label="Copy URL" />
        </div>

        <div className="text-sm text-gray-600 space-y-2">
          <p>
            Returns <strong>all OSC requests</strong> as JSON. Authenticate with the daily key, passed either way:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>
              <strong>Header</strong> (recommended): <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">X-API-Key: &lt;key&gt;</code>
            </li>
            <li>
              <strong>Query parameter</strong>: <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">?api_key=&lt;key&gt;</code>
            </li>
          </ul>
          <p className="text-xs text-gray-500">
            The response is an object with <code className="bg-gray-100 rounded px-1 py-0.5">generatedAt</code>,{' '}
            <code className="bg-gray-100 rounded px-1 py-0.5">count</code>, and a{' '}
            <code className="bg-gray-100 rounded px-1 py-0.5">data</code> array containing one record per OSC request.
          </p>
        </div>

        <div>
          <p className="jira-field-label">Example (command line)</p>
          <CodeBlock code={curlExample} />
        </div>
      </section>

      {/* ── Excel / Power Query guide ── */}
      <section className="jira-panel p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-900">Load into Excel with Power Query</h2>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>In Excel, go to <strong>Data → Get Data → From Other Sources → Blank Query</strong>.</li>
          <li>In the Power Query editor, open <strong>Home → Advanced Editor</strong>.</li>
          <li>Delete the contents and paste the script below (it already contains today&apos;s key and your server address), then click <strong>Done</strong>.</li>
          <li>If Excel asks how to connect, choose <strong>Anonymous</strong> and click <strong>Connect</strong> — authentication is handled by the API key inside the script.</li>
          <li>Click <strong>Close &amp; Load</strong>. The OSC requests appear as a refreshable table in your sheet.</li>
          <li>To refresh later, use <strong>Data → Refresh All</strong>. If the refresh fails with a 401 error, the daily key has rotated — copy the new key from this page and replace the <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">ApiKey</code> value in the Advanced Editor.</li>
        </ol>

        <div>
          <p className="jira-field-label">Power Query script (M)</p>
          <CodeBlock code={powerQueryCode} />
        </div>

        <p className="text-xs text-gray-500">
          Tip: you can also use <strong>Data → From Web</strong> and paste the ready-made URL below, but the script
          above is easier to update when the key changes.
        </p>

        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700">
            {showKey ? urlWithKey : `${endpointUrl}?api_key=${maskedKey}`}
          </code>
          <CopyButton text={urlWithKey} label="Copy URL + key" />
        </div>
      </section>

      {/* ── Response fields ── */}
      <section className="jira-panel p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Response Fields</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4 font-medium">Field</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {RESPONSE_FIELDS.map(([field, type, desc]) => (
                <tr key={field}>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-800">{field}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">{type}</td>
                  <td className="py-2 text-gray-600">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Troubleshooting ── */}
      <section className="jira-panel p-6 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900">Troubleshooting</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-4 font-medium whitespace-nowrap">Error</th>
              <th className="py-2 font-medium">What it means / what to do</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4 font-mono text-xs text-red-600 whitespace-nowrap">401 Unauthorized</td>
              <td className="py-2 text-gray-600">
                The API key is wrong or has expired (keys rotate daily at midnight UTC). Copy today&apos;s key from
                the top of this page and update it in your query.
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs text-red-600 whitespace-nowrap">Couldn&apos;t connect</td>
              <td className="py-2 text-gray-600">
                Check that the server address is correct and reachable from your network, and that you selected{' '}
                <strong>Anonymous</strong> as the connection method in Excel.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
