'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  generateWhatsAppLink,
  generateGroupWhatsAppLink,
  generateInviteWhatsAppLink,
} from '@/lib/notifications'
import { AuthUser, getStoredUser, saveStoredUser, clearStoredUser } from '@/lib/authClient'
import { AuthCard } from '@/components/AuthCard'
import { DatePickerField } from '@/components/DatePickerField'

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

interface MemberRow {
  event_id: string
  user_id: string
  display_name: string
  role: 'organizer' | 'participant'
  joined_at: string
  has_preferences?: boolean
}

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

export default function EventPage() {
  const params = useParams()
  const router = useRouter()
  const rawCode = (params?.code as string) || ''
  const code = rawCode.trim().toUpperCase()

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [event, setEvent] = useState<EventRow | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [progress, setProgress] = useState({ total: 0, completed: 0, status: 'open' as EventRow['status'] })

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [screen, setScreen] = useState<'loading' | 'auth' | 'join' | 'prefs' | 'room'>('loading')

  // Form states for prefs
  const [prefs, setPrefs] = useState(['', '', ''])

  // Organizer settings modal
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBudgetMin, setEditBudgetMin] = useState(50000)
  const [editBudgetMax, setEditBudgetMax] = useState(100000)
  const [editDate, setEditDate] = useState('')
  const [editRules, setEditRules] = useState('')
  const [editGiftType, setEditGiftType] = useState('Camisetas de fútbol')

  // Toasts
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info')

  const notify = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessage(text)
    setMessageType(type)
  }

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 7000)
    return () => clearTimeout(timer)
  }, [message])

  // Cargar información de miembros y progreso
  const refreshMembers = useCallback(async (eventId: string) => {
    try {
      const data = await api<{ members: MemberRow[]; progress: { total: number; completed: number; status: string } }>(
        `/api/events/members?event_id=${eventId}`
      )
      setMembers(data.members)
      setProgress({
        total: data.progress.total,
        completed: data.progress.completed,
        status: data.progress.status as EventRow['status'],
      })
      return data
    } catch (err) {
      console.error('Error cargando miembros:', err)
      return null
    }
  }, [])

  // Evaluar estado del usuario en el evento
  const evaluateUserInEvent = useCallback(
    async (user: AuthUser, ev: EventRow, currentMembers: MemberRow[]) => {
      const isMember = currentMembers.some(m => m.user_id === user.id)

      if (isMember) {
        // Consultar preferencias del usuario
        try {
          const myPrefs = await api<string[]>(`/api/events/prefs?event_id=${ev.id}&user_id=${user.id}`)
          const loadedPrefs = ['', '', '']
          if (myPrefs && myPrefs.length > 0) {
            myPrefs.forEach((p, i) => {
              if (i < 3) loadedPrefs[i] = p
            })
          } else if (user.preferences && user.preferences.length >= 3) {
            user.preferences.forEach((p, i) => {
              if (i < 3) loadedPrefs[i] = p
            })
          }
          setPrefs(loadedPrefs)

          const validPrefsCount = loadedPrefs.filter(Boolean).length
          const requiredCount = ev.preference_count || 3

          if (validPrefsCount >= requiredCount) {
            // Ya cargó todas sus camisetas no deseadas -> VA DIRECTO A LA SALA
            setScreen('room')
          } else {
            // Le faltan completar sus preferencias
            setScreen('prefs')
          }
        } catch {
          if (user.preferences && user.preferences.length >= 3) {
            const loadedPrefs = ['', '', '']
            user.preferences.forEach((p, i) => {
              if (i < 3) loadedPrefs[i] = p
            })
            setPrefs(loadedPrefs)
            setScreen('room')
          } else {
            setScreen('prefs')
          }
        }
      } else {
        // Está logueado pero aún no se unió a este evento
        setScreen('join')
      }
    },
    []
  )

  // Inicializar y cargar el evento
  const loadEvent = useCallback(async () => {
    if (!code) return
    setLoading(true)
    try {
      const ev = await api<EventRow>(`/api/events?code=${code}`)
      setEvent(ev)
      setEditName(ev.name)
      setEditBudgetMin(ev.budget_min || 50000)
      setEditBudgetMax(ev.budget_max || 100000)
      setEditDate(ev.event_date || '')
      setEditRules(ev.rules || '')
      setEditGiftType(ev.gift_type || 'Camisetas de fútbol')

      const membersData = await refreshMembers(ev.id)
      const currentMembers = membersData?.members || []

      // Verificar si hay sesión activa en este dispositivo
      const activeUser = getStoredUser()
      if (activeUser) {
        setCurrentUser(activeUser)
        await evaluateUserInEvent(activeUser, ev, currentMembers)
      } else {
        // No está logueado -> Mostrar pantalla de autenticación
        setCurrentUser(null)
        setScreen('auth')
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al buscar el evento', 'error')
    } finally {
      setLoading(false)
    }
  }, [code, refreshMembers, evaluateUserInEvent])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  // Polling automático de participantes cada 3 segundos si estamos en la sala
  useEffect(() => {
    if (screen !== 'room' || !event?.id) return
    const interval = setInterval(async () => {
      await refreshMembers(event.id)
    }, 3000)
    return () => clearInterval(interval)
  }, [screen, event?.id, refreshMembers])

  // Manejo cuando el usuario inicia sesión o se registra con éxito en AuthCard
  const handleAuthSuccess = async (user: AuthUser) => {
    setCurrentUser(user)
    notify(`¡Sesión iniciada como ${user.display_name}!`, 'success')

    if (event) {
      const membersData = await refreshMembers(event.id)
      const currentMembers = membersData?.members || []
      await evaluateUserInEvent(user, event, currentMembers)
    }
  }

  // Cerrar sesión
  const handleLogout = () => {
    clearStoredUser()
    setCurrentUser(null)
    setScreen('auth')
    notify('Sesión cerrada.', 'info')
  }

  // Unirse al evento con la cuenta actual
  async function handleJoin() {
    if (!currentUser || !event) {
      setScreen('auth')
      return
    }

    setBusy(true)
    try {
      const data = await api<{ event: EventRow; members: MemberRow[]; myPrefs: string[] }>('/api/events/join', {
        method: 'POST',
        body: JSON.stringify({
          code,
          user_id: currentUser.id,
          display_name: currentUser.display_name,
        }),
      })

      setEvent(data.event)
      setMembers(data.members)
      await refreshMembers(data.event.id)

      const nextPrefs = ['', '', '']
      if (data.myPrefs && data.myPrefs.length > 0) {
        data.myPrefs.forEach((val: string, i: number) => {
          if (i < 3) nextPrefs[i] = val
        })
      } else if (currentUser.preferences && currentUser.preferences.length >= 3) {
        currentUser.preferences.forEach((val: string, i: number) => {
          if (i < 3) nextPrefs[i] = val
        })
      }
      setPrefs(nextPrefs)

      const validCount = nextPrefs.filter(Boolean).length
      const required = data.event.preference_count || 3

      if (data.event.status === 'drawn') {
        router.push(`/regalo?code=${code}`)
      } else if (validCount >= required) {
        setScreen('room')
        notify('¡Ya estás en la sala!', 'success')
      } else {
        setScreen('prefs')
        notify('¡Te sumaste al evento! Ahora cargá tus camisetas no deseadas.', 'success')
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al unirte al evento', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Guardar preferencias de camisetas
  async function handleSavePrefs() {
    if (!event || !currentUser) return
    const cleaned = prefs.map(p => p.trim())
    if (cleaned.some(p => !p)) {
      notify('Por favor completá las 3 camisetas que NO querés recibir.', 'error')
      return
    }

    setBusy(true)
    try {
      await api('/api/events/prefs', {
        method: 'POST',
        body: JSON.stringify({ event_id: event.id, user_id: currentUser.id, preferences: cleaned }),
      })

      // Guardar también en la sesión local
      const updatedUser: AuthUser = { ...currentUser, preferences: cleaned }
      setCurrentUser(updatedUser)
      saveStoredUser(updatedUser)

      await refreshMembers(event.id)
      setScreen('room')
      notify('¡Preferencias guardadas exitosamente!', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al guardar preferencias', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Guardar cambios de configuración del evento (organizador)
  async function handleSaveSettings() {
    if (!event || !currentUser) return
    setBusy(true)
    try {
      const updated = await api<EventRow>('/api/events', {
        method: 'PATCH',
        body: JSON.stringify({
          id: event.id,
          user_id: currentUser.id,
          name: editName,
          budget_min: editBudgetMin,
          budget_max: editBudgetMax,
          event_date: editDate || null,
          rules: editRules,
          gift_type: editGiftType,
        }),
      })
      setEvent(updated)
      setShowConfigModal(false)
      notify('Configuración del evento guardada.', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al guardar configuración', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Realizar el sorteo (organizador)
  async function handleDraw() {
    if (!event) return
    setBusy(true)
    notify('Generando sorteo secreto entre los participantes…')

    try {
      await api('/api/events/draw', {
        method: 'POST',
        body: JSON.stringify({ event_id: event.id }),
      })

      setEvent(prev => (prev ? { ...prev, status: 'drawn' } : null))
      setProgress(prev => ({ ...prev, status: 'drawn' }))
      notify('🎉 ¡Sorteo realizado con éxito!', 'success')
      router.push(`/regalo?code=${code}`)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al realizar el sorteo', 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directUrl = `${origin}/evento/${code}`
    try {
      await navigator.clipboard.writeText(directUrl)
      notify('Link copiado al portapapeles: ' + directUrl, 'success')
    } catch {
      notify(`Link directo: ${directUrl}`, 'info')
    }
  }

  const isOrganizer = Boolean(currentUser && event && event.organizer_id === currentUser.id)
  const readyToDraw = progress.total >= 2 && progress.completed === progress.total && event?.status === 'open'
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  if (loading) {
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
        <main className="page" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <h2>Cargando evento {code}…</h2>
          <p style={{ color: '#8aa494' }}>Consultando el estado de la cancha...</p>
        </main>
      </div>
    )
  }

  if (!event) {
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
        <main className="page" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <h2>⚠️ Evento no encontrado</h2>
          <p style={{ color: '#8aa494', marginBottom: 24 }}>
            No encontramos ningún sorteo con el código <strong>{code}</strong>.
          </p>
          <Link href="/" className="button primary large">
            ← Volver al inicio
          </Link>
        </main>
      </div>
    )
  }

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
        <div className="topbar-right">
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="user-chip">👤 {currentUser.display_name}</span>
              <button
                onClick={handleLogout}
                className="button ghost small-button"
                style={{ padding: '5px 10px', fontSize: 12 }}
                title="Cerrar sesión"
              >
                Salir
              </button>
            </div>
          ) : (
            <span className="user-chip" style={{ opacity: 0.8 }}>🔒 Requiere cuenta</span>
          )}
        </div>
      </header>

      <main className="page">
        {/* Banner de invitación directa */}
        <section className="share-banner">
          <div className="share-banner-info">
            <strong>⚽ {event.name} (Código: {event.code})</strong>
            <p>
              💰 Presupuesto: ${event.budget_min.toLocaleString('es-AR')} – ${event.budget_max.toLocaleString('es-AR')}
              {event.event_date
                ? ` · 📅 Entrega: ${new Date(`${event.event_date}T12:00:00`).toLocaleDateString('es-AR')}`
                : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={generateInviteWhatsAppLink(
                event.name,
                event.code,
                siteUrl,
                event.budget_min,
                event.budget_max,
                event.event_date,
                event.rules
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="button whatsapp"
            >
              📲 Invitar por WhatsApp
            </a>
            <button className="button ghost small-button" onClick={copyLink}>
              📋 Copiar link directo
            </button>
          </div>
        </section>

        {/* PANTALLA: AUTENTICACIÓN PREVIA OBLIGATORIA */}
        {screen === 'auth' && (
          <section className="content-layout narrow">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div className="eyebrow" style={{ color: '#22c55e' }}>Acceso al evento</div>
              <h2 style={{ margin: '6px 0', fontSize: 24 }}>{event.name}</h2>
              <p style={{ color: '#8aa494', fontSize: 14 }}>
                Para entrar y guardar tus preferencias de camisetas en todos tus dispositivos, ingresá con tu cuenta.
              </p>
            </div>

            <AuthCard
              onSuccess={handleAuthSuccess}
              title="Ingresá a la Cancha"
              subtitle="Iniciá sesión o registrate con tu usuario y contraseña (sin validaciones raras)."
            />
          </section>
        )}

        {/* PANTALLA: UNIRSE (USUARIO LOGUEADO PERO AÚN NO MIEMBRO) */}
        {screen === 'join' && currentUser && (
          <section className="content-layout narrow">
            <div className="form-card">
              <div className="step-badge">Sumarse al plantel</div>
              <div className="eyebrow">Código de sala: {event.code}</div>
              <h2>{event.name}</h2>
              <p className="lead">
                ¡Hola <strong>{currentUser.display_name}</strong>! Anotate en este Amigo Invisible con un solo clic.
              </p>

              <div className="form-grid" style={{ marginTop: 16 }}>
                <div className="readonly-card">
                  <span>Tu usuario</span>
                  <strong>@{currentUser.username}</strong>
                </div>
                <div className="readonly-card">
                  <span>Tu nombre de jugador</span>
                  <strong>{currentUser.display_name}</strong>
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: 12 }}>
                <div className="readonly-card">
                  <span>Presupuesto</span>
                  <strong>${event.budget_min.toLocaleString('es-AR')} – ${event.budget_max.toLocaleString('es-AR')}</strong>
                </div>
                <div className="readonly-card">
                  <span>Regla del organizador</span>
                  <strong>{event.rules || 'Libre'}</strong>
                </div>
              </div>

              <button
                className="button primary large full"
                onClick={handleJoin}
                disabled={busy}
                style={{ marginTop: 24 }}
              >
                {busy ? 'Sumándote…' : `⚽ Sumarme como ${currentUser.display_name} →`}
              </button>
            </div>
          </section>
        )}

        {/* PANTALLA: CARGAR PREFERENCIAS */}
        {screen === 'prefs' && (
          <section className="content-layout narrow">
            <div className="form-card">
              {prefs.filter(Boolean).length >= 3 && (
                <button className="back-link" onClick={() => setScreen('room')}>
                  ← Volver a la sala
                </button>
              )}
              <div className="step-badge">Paso obligatorio</div>
              <div className="eyebrow">{event.name}</div>
              <h2>Camisetas No Deseadas 🚫</h2>
              <p className="lead">
                Cargá las 3 camisetas o selecciones que NO querés recibir para que tu amigo invisible no se equivoque.
                Se recordarán en tu cuenta para que no tengas que volver a cargarlas en futuros eventos.
              </p>

              {prefs.map((val, idx) => (
                <div key={idx} className="pref-field">
                  <span>🚫 No deseado #{idx + 1}</span>
                  <input
                    value={val}
                    onChange={e => setPrefs(prev => prev.map((item, i) => (i === idx ? e.target.value : item)))}
                    placeholder={['Ej. Real Madrid', 'Ej. Brasil', 'Ej. Manchester City'][idx]}
                  />
                </div>
              ))}

              <button
                className="button primary large full"
                onClick={handleSavePrefs}
                disabled={busy}
                style={{ marginTop: 20 }}
              >
                {busy ? 'Guardando…' : 'Guardar y entrar a la sala →'}
              </button>
            </div>
          </section>
        )}

        {/* PANTALLA: SALA DEL EVENTO */}
        {screen === 'room' && (
          <section className="room">
            <div className="room-head">
              <div>
                <div className="eyebrow">Sala de encuentro</div>
                <h2>{event.name}</h2>
                <p>
                  💰 Presupuesto: <strong>${event.budget_min.toLocaleString('es-AR')} – ${event.budget_max.toLocaleString('es-AR')}</strong>
                  {event.event_date
                    ? ` · 📅 Entrega: ${new Date(`${event.event_date}T12:00:00`).toLocaleDateString('es-AR')}`
                    : ' · 📅 Fecha por confirmar'}
                </p>
              </div>
              <div className="code-card">
                <span>Código de sala</span>
                <strong>{event.code}</strong>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="button ghost small-button" onClick={copyLink}>
                    Copiar link
                  </button>
                  {isOrganizer && event.status !== 'drawn' && (
                    <button className="button secondary small-button" onClick={() => setShowConfigModal(true)}>
                      ⚙️ Configurar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Aviso si ya fue sorteado */}
            {event.status === 'drawn' && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #10331e, #07190e)',
                  border: '1px solid #22c55e',
                  borderRadius: 20,
                  padding: '24px',
                  marginBottom: 24,
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 36 }}>🎉</span>
                <h3 style={{ fontSize: 24, margin: '8px 0', color: '#e8fbf0' }}>¡El sorteo ya fue realizado!</h3>
                <p style={{ color: '#98cbb0', marginBottom: 16 }}>
                  Cada jugador ya tiene asignado a su amigo invisible en secreto.
                </p>
                <button className="button primary large" onClick={() => router.push(`/regalo?code=${code}`)}>
                  🎁 Ver mi amigo invisible asignado →
                </button>
              </div>
            )}

            <div className="room-grid">
              <div className="member-card">
                <div className="section-title">
                  <div>
                    <div className="eyebrow">Plantel de participantes</div>
                    <h3>
                      {members.length} Jugador{members.length === 1 ? '' : 'es'}
                    </h3>
                  </div>
                  <span className={`status-chip ${readyToDraw ? 'ready' : ''}`}>
                    {event.status === 'drawn'
                      ? 'Sorteo realizado'
                      : readyToDraw
                      ? '¡Listos para sortear!'
                      : `${progress.completed}/${progress.total} listos`}
                  </span>
                </div>

                <div className="member-list">
                  {members.map(member => (
                    <div className="member-row" key={member.user_id}>
                      <div className="avatar">{member.display_name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>
                          {member.display_name} {currentUser?.id === member.user_id ? '(Vos)' : ''}
                        </strong>
                        <span>{member.role === 'organizer' ? '⭐ Organizador' : '⚽ Jugador'}</span>
                      </div>
                      <span className={`pref-badge ${member.has_preferences ? 'complete' : 'pending'}`}>
                        {member.has_preferences ? '✓ Listo' : '⏳ Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Panel exclusivo del Organizador */}
                {isOrganizer && (
                  <div className="draw-panel" style={{ marginTop: 24 }}>
                    <div className="draw-panel-info">
                      <strong>Panel del Organizador</strong>
                      <p>
                        {progress.completed} de {progress.total} participantes completaron sus no deseados.
                      </p>
                    </div>

                    {event.status === 'open' ? (
                      <button
                        className="button primary large full"
                        onClick={handleDraw}
                        disabled={!readyToDraw || busy}
                        style={{ marginTop: 12 }}
                      >
                        {busy ? 'Sorteando…' : '🎲 Realizar sorteo del Amigo Invisible'}
                      </button>
                    ) : (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="button primary large full" style={{ opacity: 0.9, textAlign: 'center' }}>
                          ✓ Sorteo completado
                        </div>
                        <button className="button secondary full" onClick={() => router.push(`/regalo?code=${code}`)}>
                          🎁 Ver a quién te tocó regalar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Notificaciones WhatsApp por parte del organizador tras el sorteo */}
                {event.status === 'drawn' && isOrganizer && (
                  <div className="wa-dashboard" style={{ marginTop: 24 }}>
                    <div className="wa-dashboard-head">
                      <span>📲</span>
                      <h4>Avisos por WhatsApp</h4>
                    </div>
                    <p style={{ fontSize: 13, color: '#88aa94', margin: '4px 0 12px' }}>
                      Enviá el aviso al grupo o el mensaje privado a cada jugador:
                    </p>

                    <a
                      href={generateGroupWhatsAppLink(event.name, event.code, siteUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button whatsapp full"
                      style={{ marginBottom: 12 }}
                    >
                      📢 Aviso general al grupo de WhatsApp
                    </a>

                    <div className="wa-list">
                      {members.map(m => (
                        <div key={m.user_id} className="wa-row">
                          <span>👤 {m.display_name}</span>
                          <button
                            className="button whatsapp small-button"
                            onClick={async () => {
                              try {
                                const r = await api<{ recipientName: string; preferences: string[] }>('/api/events/result', {
                                  method: 'POST',
                                  body: JSON.stringify({ event_id: event.id, user_id: m.user_id }),
                                })
                                window.open(
                                  generateWhatsAppLink(m.display_name, r.recipientName, r.preferences, event.name, event.code),
                                  '_blank'
                                )
                              } catch {
                                notify('No se pudo generar enlace para ' + m.display_name, 'error')
                              }
                            }}
                          >
                            Enviar resultado privado
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botón para cambiar mis preferencias */}
                {event.status === 'open' && (
                  <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <button className="button ghost small-button" onClick={() => setScreen('prefs')}>
                      ✏️ Modificar mis camisetas no deseadas
                    </button>
                  </div>
                )}
              </div>

              {/* Aside informativo */}
              <aside className="info-card">
                <div className="big-lock">🔐</div>
                <div className="eyebrow">Privacidad asegurada</div>
                <h3>Sorteo 100% secreto.</h3>
                <p>Nadie sabe a quién le regala el resto. Vos solo verás la camiseta y los no deseados de quien te toque.</p>
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1a3824' }}>
                  <span style={{ fontSize: 12, color: '#688e76', display: 'block', marginBottom: 6 }}>
                    LINK DIRECTO A ESTA SALA:
                  </span>
                  <code style={{ fontSize: 12, color: '#90f0b4', wordBreak: 'break-all' }}>
                    {siteUrl}/evento/{event.code}
                  </code>
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>

      {/* MODAL CONFIGURACIÓN DEL ORGANIZADOR */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="eyebrow">Ajustes del Organizador</div>
            <h2>Configurar Evento</h2>
            <p className="lead" style={{ marginBottom: 20 }}>
              Modificá el presupuesto, fecha o reglas de este sorteo.
            </p>

            <label>
              Nombre del evento
              <input value={editName} onChange={e => setEditName(e.target.value)} />
            </label>

            <div style={{ marginTop: 14 }}>
              <label>Presupuesto mínimo ($)</label>
              <input
                type="number"
                inputMode="numeric"
                value={editBudgetMin}
                onChange={e => setEditBudgetMin(Number(e.target.value))}
                min={0}
                step={5000}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <label>Presupuesto máximo ($)</label>
              <input
                type="number"
                inputMode="numeric"
                value={editBudgetMax}
                onChange={e => setEditBudgetMax(Number(e.target.value))}
                min={0}
                step={5000}
              />
            </div>

            {/* Presets rápidos */}
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 12, color: '#8aa494' }}>Presets de presupuesto:</span>
              <div className="preset-group">
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    setEditBudgetMin(30000)
                    setEditBudgetMax(60000)
                  }}
                >
                  $30k – $60k
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    setEditBudgetMin(50000)
                    setEditBudgetMax(100000)
                  }}
                >
                  $50k – $100k
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    setEditBudgetMin(80000)
                    setEditBudgetMax(150000)
                  }}
                >
                  $80k – $150k
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <DatePickerField
                label="Fecha de entrega / partido"
                value={editDate}
                onChange={setEditDate}
                helperText="Elegí la fecha desplegando el calendario o con los botones rápidos."
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <label>
                Reglas o condiciones especiales
                <input
                  value={editRules}
                  onChange={e => setEditRules(e.target.value)}
                  placeholder="Ej. Solo camisetas internacionales, réplicas permitidas"
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="button primary large" onClick={handleSaveSettings} disabled={busy} style={{ flex: 1 }}>
                {busy ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button className="button secondary large" onClick={() => setShowConfigModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      {message && (
        <div className={`toast ${messageType}`} role="status">
          <span>{messageType === 'error' ? '⚠️' : messageType === 'success' ? '✓' : 'ℹ️'}</span>
          <p>{message}</p>
          <button onClick={() => setMessage('')} aria-label="Cerrar">
            ×
          </button>
        </div>
      )}

      <footer className="footer">
        <span>⚽ Amigo Invisible · Fulbito</span>
        <Link href="/" style={{ color: '#88a693', textDecoration: 'none' }}>
          Volver al inicio
        </Link>
      </footer>
    </div>
  )
}
