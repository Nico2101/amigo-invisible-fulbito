import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/'

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=missing_code', request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const target = new URL('/', request.url)
    target.searchParams.set('auth_error', error.message)
    return NextResponse.redirect(target)
  }

  const target = new URL(next.startsWith('/') ? next : '/', request.url)
  return NextResponse.redirect(target)
}
