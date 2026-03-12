import { NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/dashboard', '/upload', '/profiel'];

function hasSupabaseSessionCookie(request) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hasSession = hasSupabaseSessionCookie(request);

  if (pathname.startsWith('/login') && hasSession) {
    return NextResponse.redirect(new URL('/markt', request.url));
  }

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Client-side auth uses Supabase browser storage and can be valid
  // without a server-visible auth cookie. Let protected pages do the
  // definitive auth check client-side to avoid false redirects.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
