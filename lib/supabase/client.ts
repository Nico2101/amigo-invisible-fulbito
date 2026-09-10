import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ypfyhmpajhsvscgljytz.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_noQHHqYWh-_GjBmc6hWnVA_O0CgeV0I'
  return createBrowserClient(url, key)
}
