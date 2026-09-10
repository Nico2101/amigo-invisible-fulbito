'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface LocalUser {
  id: string
  name: string
  email: string
  phone: string
}

interface EventRow {
  id: string
  code: string
  name: string
  gift_type: string
  theme: string
  budget_min: number
  budget_max: number
  event_date: string | null
  rules: string
  preference_count: number
  status: 'open' | 'drawn' | 'closed'
  organizer_id: string
}

interface ResultData {
  recipientName: string
  preferences: string[]
  eventName: string
  eventCode: string
  eventDate: string | null
  budgetMin: number
  budgetMax: number
  rules: string
  giftType: string
}

const USER_SESSION_KEY = 'amigo-invisible.user-session.v5'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`)
  }
  return data as T
}

function RegaloContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeParam = searchParams.get('code') || ''

  const [currentUser, setCurrentUser] = useState<LocalUser | null>(null)
  const [event, setEvent] = useState<EventRow | null>(null)
  const [result, setResult] = useState<ResultData | null>(null)
  const [isRevealed, setIsRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const stored = localStorage.getItem(USER_SESSION_KEY)
      let user: LocalUser | null = null
      if (stored) {
        user = JSON.parse(stored)
        setCurrentUser(user)
      }

      if (!user) {
        setError('No encontramos tu sesión de jugador en este dispositivo. Por favor ingresá a la sala con tu nombre primero.')
        setLoading(false)
        return
      }

      let eventCode = codeParam.trim().toUpperCase()
      if (!eventCode) {
        // Buscar código guardado previamente
        eventCode = localStorage.getItem('amigo_last_event_code') || ''
      }

      if (!eventCode) {
        setError('No se especificó un código de evento. Por favor ingresá a la sala desde el enlace del evento.')
        setLoading(false)
        return
      }

      // Guardar último código para recargas sin query params
      localStorage.setItem('amigo_last_event_code', eventCode)

      const ev = await api<EventRow>(`/api/events?code=${eventCode}`)
      setEvent(ev)

      if (ev.status !== 'drawn') {
        setError('El sorteo de este evento todavía no se ha realizado. Volvé a la sala para ver el progreso.')
        setLoading(false)
        return
      }

      const res = await api<ResultData>('/api/events/result', {
        method: 'POST',
        body: JSON.stringify({ event_id: ev.id, user_id: user.id }),
      })

      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener tu amigo invisible.')
    } finally {
      setLoading(false)
    }
  }, [codeParam])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h2>Revelando asignación secreta…</h2>
        <p style={{ color: '#8aa494' }}>Buscando a quién te tocó regalarle...</p>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
        <h2>No pudimos cargar tu resultado</h2>
        <p style={{ color: '#f5c6c2', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.5 }}>{error}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {event?.code ? (
            <Link href={`/evento/${event.code}`} className="button primary large">
              ← Ir a la sala del evento
            </Link>
          ) : (
            <Link href="/" className="button primary large">
              ← Volver al inicio
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="result-page">
      <div className="result-hero">
        <div className="step-badge">🎁 Sorteo completado</div>
        <div className="eyebrow">{result.eventName} · Código: {result.eventCode}</div>
        <h2>En este sorteo te tocó regalarle a…</h2>

        <div className="secret-reveal-box">
          {isRevealed ? (
            <>
              <div className="recipient">{result.recipientName}</div>
              <button className="button ghost small-button" onClick={() => setIsRevealed(false)}>
                🙈 Ocultar nombre
              </button>
            </>
          ) : (
            <>
              <div className="recipient" style={{ filter: 'blur(10px)', userSelect: 'none' }}>
                ???????????
              </div>
              <button className="button primary large" onClick={() => setIsRevealed(true)}>
                👁️ Tocá para revelar el resultado
              </button>
            </>
          )}
        </div>
      </div>

      <div className="result-grid">
        <div className="result-card">
          <span>🚫 CAMISETAS NO DESEADAS</span>
          <h3>Lista a evitar</h3>
          <div className="chip-list">
            {result.preferences.length > 0 ? (
              result.preferences.map((item, idx) => (
                <span key={idx}>❌ {item}</span>
              ))
            ) : (
              <span>Sin preferencias registradas</span>
            )}
          </div>
          <small style={{ color: '#7e9f8b', display: 'block', marginTop: 10 }}>
            No le compres ninguna camiseta o indumentaria de estos equipos.
          </small>
        </div>

        <div className="result-card">
          <span>💰 PRESUPUESTO</span>
          <h3>${result.budgetMin.toLocaleString('es-AR')} – ${result.budgetMax.toLocaleString('es-AR')}</h3>
          <p>Monto fijado por el organizador para este evento.</p>
        </div>

        <div className="result-card">
          <span>📅 FECHA DE ENTREGA</span>
          <h3>
            {result.eventDate
              ? new Date(`${result.eventDate}T12:00:00`).toLocaleDateString('es-AR')
              : 'A confirmar con el grupo'}
          </h3>
          <p>{result.rules || 'No olvides llevar el regalo empaquetado.'}</p>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32, display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href={`/evento/${result.eventCode}`} className="button secondary large">
          ← Volver a la sala del evento
        </Link>
        <Link href="/" className="button ghost large">
          Ir al inicio
        </Link>
      </div>
    </section>
  )
}

export default function RegaloPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Ir al inicio">
          <span className="brand-ball">⚽</span>
          <span>
            <strong>Amigo Invisible</strong>
            <small>FULBITO</small>
          </span>
        </Link>
      </header>

      <main className="page">
        <Suspense fallback={
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <h2>Cargando regalo…</h2>
          </div>
        }>
          <RegaloContent />
        </Suspense>
      </main>

      <footer className="footer">
        <span>⚽ Amigo Invisible · Fulbito</span>
        <Link href="/" style={{ color: '#88a693', textDecoration: 'none' }}>Inicio</Link>
      </footer>
    </div>
  )
}
