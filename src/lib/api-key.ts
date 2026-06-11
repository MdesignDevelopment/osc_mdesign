import crypto from 'crypto'

// Daily-rotating API key for the external data API (/api/v1/*).
// The key is derived from a server secret + the current UTC date, so it
// automatically changes at midnight UTC without any cron job or database
// state. The same derivation runs on the API Integration page (to display
// the key) and in the API route (to validate it).

const KEY_PREFIX = 'osc_'

function getSecret(): string {
  const secret = process.env.API_KEY_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('API_KEY_SECRET or NEXTAUTH_SECRET must be set')
  }
  return secret
}

/** Current date in UTC as yyyy-MM-dd — the rotation unit for keys. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function apiKeyForDate(dateUtc: string): string {
  const digest = crypto
    .createHmac('sha256', getSecret())
    .update(`osc-api-key:${dateUtc}`)
    .digest('hex')
  return KEY_PREFIX + digest.slice(0, 40)
}

/** The API key that is valid right now (rotates at midnight UTC). */
export function getTodayApiKey(): string {
  return apiKeyForDate(todayUtc())
}

/** Moment the current key stops working: next midnight UTC. */
export function getKeyValidUntil(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
}

/** Timing-safe check of a candidate key against today's key. */
export function validateApiKey(candidate: string | null | undefined): boolean {
  if (!candidate) return false
  const expected = getTodayApiKey()
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
