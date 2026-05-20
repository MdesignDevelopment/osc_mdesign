const attempts = new Map<string, { count: number; resetAt: number }>()

// Sweep expired entries every 30 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  attempts.forEach((entry, key) => {
    if (now > entry.resetAt) attempts.delete(key)
  })
}, 30 * 60 * 1000).unref()

export function checkRateLimit(
  ip: string,
  maxAttempts = 10,
  windowMs = 15 * 60 * 1000,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = attempts.get(ip)

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true }
}

export function resetRateLimit(ip: string) {
  attempts.delete(ip)
}
