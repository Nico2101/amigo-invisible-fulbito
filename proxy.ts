import { type NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  // Pass through sin Supabase auth
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
