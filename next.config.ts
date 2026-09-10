import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.0.100'],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ypfyhmpajhsvscgljytz.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_noQHHqYWh-_GjBmc6hWnVA_O0CgeV0I',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || '',
  },
  async rewrites() {
    return [
      {
        source: '/evento:code([A-Za-z0-9]{6})',
        destination: '/evento/:code',
      },
    ]
  },
}

export default nextConfig
