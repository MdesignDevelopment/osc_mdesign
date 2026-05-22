export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/osc/:path*', '/users/:path*', '/settings/:path*'],
}
