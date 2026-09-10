'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function EventoRegaloPage() {
  const params = useParams()
  const router = useRouter()
  const code = ((params?.code as string) || '').trim().toUpperCase()

  useEffect(() => {
    if (code) {
      router.replace(`/regalo?code=${code}`)
    } else {
      router.replace('/regalo')
    }
  }, [code, router])

  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: '#8aa494' }}>
      <h2>Cargando resultado del sorteo…</h2>
    </div>
  )
}
