import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextRequest } from 'next/server'

const handler = NextAuth(authOptions)

export async function GET(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  return handler(req, ctx)
}

export async function POST(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'

  const { allowed, retryAfter } = checkRateLimit(ip)
  if (!allowed) {
    return Response.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  return handler(req, ctx)
}
