import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl
  const cookies = request.cookies.getAll()
  
  console.log('PATH:', pathname)
  console.log('COOKIES:', cookies.map(c => c.name))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
