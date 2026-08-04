export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/osc/:path*',
    '/design-sessions/:path*',
    '/addresses/:path*',
    '/history/:path*',
    '/users/:path*',
    '/settings/:path*',
    '/api-integration/:path*',
  ],
}
