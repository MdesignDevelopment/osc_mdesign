import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import { can, type Capability } from '@/lib/permissions'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })

        if (!user) return null
        if (!user.active) return null

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role
        token.id = user.id
        return token
      }
      // Re-validate on every token refresh
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, active: true },
        })
        if (!dbUser || !dbUser.active) return null as any
        token.role = dbUser.role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
}

export const getSession = () => getServerSession(authOptions)

export const requireAuth = async () => {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

export const requireRole = async (roles: Role[]) => {
  const session = await requireAuth()
  if (!roles.includes(session.user.role as Role)) throw new Error('Forbidden')
  return session
}

/**
 * Throwing capability guard, for server components and actions.
 * API routes should use `authorize()` from lib/api-auth, which returns a
 * response instead of throwing and matches the existing route style.
 */
export const requireCapability = async (cap: Capability) => {
  const session = await requireAuth()
  if (!can(session.user.role as Role, cap)) throw new Error('Forbidden')
  return session
}
