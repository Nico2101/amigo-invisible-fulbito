import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Amigo Invisible · Fulbito',
  description: 'Organizá tu amigo invisible de camisetas de fútbol con tus amigos.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Amigo Fulbito',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#050e09',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
