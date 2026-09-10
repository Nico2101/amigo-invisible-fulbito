'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthUser, getStoredUser, clearStoredUser } from '@/lib/authClient'
import { AuthCard } from '@/components/AuthCard'
import { DatePickerField } from '@/components/DatePickerField'

interface UserEventItem {
  event: {
    id: string
    code: string
    name: string
    budget_min: number
    budget_max: number
    event_date: string | null
    status: 'open' | 'drawn' | 'closed'
    rules: string
  }
  role: 'organizer' | 'participant'
  hasPreferences: boolean
  isDrawn: boolean
}

type Screen = 'home' | 'create' | 'join'

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

export default function Home() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('home')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [userEvents, setUserEvents] = useState<UserEventItem[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Form states for creating event
  const [eventName, setEventName] = useState('Amigo Invisible · Fulbito de los Jueves')
  const [eventDate, setEventDate] = useState('')
  const [budgetMin, setBudgetMin] = useState(50000)
  const [budgetMax, setBudgetMax] = useState(100000)
  const [rules, setRules] = useState('Clubes internacionales y selecciones nacionales. No clubes argentinos.')
  const [giftType, setGiftType] = useState('Camisetas de fútbol')

  // Form states for join by code
  const [code, setCode] = useState('')

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info')
  const [busy, setBusy] = useState(false)

  const notify = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessage(text)
    setMessageType(type)
  }

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 7000)
    return () => clearTimeout(timer)
  }, [message])

  // Cargar eventos del usuario logueado
  const loadUserEvents = useCallback(async (userId: string) => {
    setLoadingEvents(true)
    try {
      const data = await api<{ events: UserEventItem[] }>(`/api/user/events?user_id=${userId}`)
      setUserEvents(data.events || [])
    } catch (err) {
      console.error('Error cargando eventos del usuario:', err)
    } finally {
      setLoadingEvents(false)
    }
  }, [])

  // Cargar sesión guardada en este dispositivo
  useEffect(() => {
    const user = getStoredUser()
    if (user) {
      setCurrentUser(user)
      loadUserEvents(user.id)
    }
  }, [loadUserEvents])

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user)
    notify(`¡Bienvenido, ${user.display_name}!`, 'success')
    loadUserEvents(user.id)
  }

  const signOut = () => {
    clearStoredUser()
    setCurrentUser(null)
    setUserEvents([])
    setScreen('home')
    notify('Sesión cerrada correctamente.', 'info')
  }

  // Crear evento
  async function handleCreateEvent() {
    if (!currentUser) {
      notify('Iniciá sesión primero para crear un evento.', 'error')
      return
    }

    const cleanEventName = eventName.trim()
    if (!cleanEventName) {
      notify('Ingresá el nombre del evento.', 'error')
      return
    }

    setBusy(true)
    try {
      const ev = await api<{ code: string }>('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          name: cleanEventName,
          organizer_id: currentUser.id,
          organizer_name: currentUser.display_name,
          event_date: eventDate || null,
          budget_min: budgetMin,
          budget_max: budgetMax,
          rules: rules.trim(),
          gift_type: giftType.trim(),
        }),
      })

      localStorage.setItem('amigo_last_event_code', ev.code)
      router.push(`/evento/${ev.code}`)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al crear evento', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Unirse por código
  function handleJoinEvent() {
    const cleanCode = code.replace(/\s+/g, '').toUpperCase()
    if (!cleanCode) {
      notify('Ingresá el código de 6 caracteres.', 'error')
      return
    }
    if (cleanCode.length < 6) {
      notify('El código debe tener 6 caracteres.', 'error')
      return
    }
    localStorage.setItem('amigo_last_event_code', cleanCode)
    router.push(`/evento/${cleanCode}`)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen('home')} aria-label="Ir al inicio">
          <span className="brand-ball">⚽</span>
          <span>
            <strong>Amigo Invisible</strong>
            <small>FULBITO</small>
          </span>
        </button>
        <div className="topbar-right">
          {currentUser ? (
            <>
              <span className="user-chip">👤 {currentUser.display_name}</span>
              <button className="button ghost small-button" onClick={signOut}>Salir</button>
            </>
          ) : (
            <span className="user-chip" style={{ opacity: 0.8 }}>Sin cuenta</span>
          )}
        </div>
      </header>

      <main className="page">
        {/* PANTALLA PRINCIPAL */}
        {screen === 'home' && (
          <>
            {/* Si no está logueado, mostrar Hero + AuthCard */}
            {!currentUser ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <section className="hero-card">
                  <div className="hero-copy">
                    <div className="eyebrow">⚽ Organizado para el grupo de cancha</div>
                    <h1>El Amigo Invisible<br /><span>sin arruinar la sorpresa.</span></h1>
                    <p>
                      Iniciá sesión o creá tu usuario para organizar tus sorteos o sumarte desde tu celular o computadora sin perder tu información.
                    </p>
                    <div className="trust-row">
                      <span>✓ Usuario y Contraseña simple</span>
                      <span>✓ Misma cuenta en celular y PC</span>
                      <span>✓ Sorteo 100% privado</span>
                    </div>
                  </div>
                  <div className="hero-visual" aria-hidden="true">
                    <div className="pitch-lines" />
                    <div className="jersey">10</div>
                    <div className="visual-tag">EDICIÓN CANCHA<b>CAMISETA DEL MISTERIO</b></div>
                  </div>
                </section>

                <div style={{ maxWidth: 520, margin: '0 auto', width: '100%' }}>
                  <AuthCard
                    onSuccess={handleAuthSuccess}
                    title="Ingresar a mi cuenta"
                    subtitle="Si no tenés cuenta, elegí 'Crear Cuenta' y poné un usuario y contraseña en 5 segundos."
                  />
                </div>
              </div>
            ) : (
              /* Si está logueado, mostrar Panel con Mis Eventos y Acciones */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <section className="share-banner">
                  <div className="share-banner-info">
                    <strong style={{ fontSize: 18 }}>⚽ ¡Hola, {currentUser.display_name}!</strong>
                    <p>Estás conectado con tu usuario <code>@{currentUser.username}</code>. Tus eventos se sincronizan automáticamente en todos tus dispositivos.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="button primary" onClick={() => setScreen('create')}>
                      ➕ Crear nuevo sorteo
                    </button>
                    <button className="button secondary" onClick={() => setScreen('join')}>
                      🔑 Tengo un código
                    </button>
                  </div>
                </section>

                {/* Sección: Mis Eventos */}
                <section>
                  <div className="section-title">
                    <div>
                      <div className="eyebrow">Tus sorteos activos</div>
                      <h2 style={{ fontSize: 26, margin: '4px 0', letterSpacing: '-0.5px' }}>Mis Eventos</h2>
                    </div>
                    {userEvents.length > 0 && (
                      <span className="user-chip">{userEvents.length} inscripto{userEvents.length === 1 ? '' : 's'}</span>
                    )}
                  </div>

                  {loadingEvents ? (
                    <div style={{ padding: '32px 0', textAlign: 'center', color: '#8ba694' }}>
                      Cargando tus eventos…
                    </div>
                  ) : userEvents.length > 0 ? (
                    <div className="my-events-grid">
                      {userEvents.map(({ event: ev, role, hasPreferences, isDrawn }) => (
                        <div key={ev.id} className="my-event-card">
                          <div>
                            <div className="my-event-card-head">
                              <span style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '4px 8px',
                                borderRadius: 8,
                                background: role === 'organizer' ? '#184224' : '#0c2214',
                                color: role === 'organizer' ? '#6be399' : '#8fa99a',
                                border: '1px solid #235431',
                              }}>
                                {role === 'organizer' ? '⭐ Organizador' : '⚽ Jugador'}
                              </span>
                              <span style={{
                                fontSize: 13,
                                fontWeight: 900,
                                color: '#fbbf24',
                                letterSpacing: 2,
                              }}>
                                #{ev.code}
                              </span>
                            </div>

                            <h3 style={{ marginTop: 10 }}>{ev.name}</h3>
                            <p>
                              💰 ${ev.budget_min.toLocaleString('es-AR')} – ${ev.budget_max.toLocaleString('es-AR')}
                              {ev.event_date ? ` · 📅 ${new Date(`${ev.event_date}T12:00:00`).toLocaleDateString('es-AR')}` : ''}
                            </p>
                          </div>

                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {isDrawn ? (
                              <Link
                                href={`/regalo?code=${ev.code}`}
                                className="button primary full"
                                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                              >
                                🎁 Ver a quién te tocó regalar
                              </Link>
                            ) : hasPreferences ? (
                              <Link href={`/evento/${ev.code}`} className="button secondary full">
                                Entrar a la sala →
                              </Link>
                            ) : (
                              <Link href={`/evento/${ev.code}`} className="button primary full">
                                ⏳ Cargar tus 3 no deseados →
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="form-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
                      <span style={{ fontSize: 36 }}>📭</span>
                      <h3 style={{ margin: '10px 0 6px' }}>Todavía no estás en ningún sorteo</h3>
                      <p style={{ color: '#8aa694', maxWidth: 440, margin: '0 auto 20px', fontSize: 14 }}>
                        Creá un nuevo Amigo Invisible para tu grupo de fútbol o pedile el código de 6 letras al organizador para sumarte.
                      </p>
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="button primary" onClick={() => setScreen('create')}>
                          Crear mi amigo invisible →
                        </button>
                        <button className="button secondary" onClick={() => setScreen('join')}>
                          Ingresar con código
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            <section className="feature-grid" style={{ marginTop: 32 }}>
              <Feature icon="🤫" title="Resultado Privado" text="Cada uno consulta únicamente su asignación." />
              <Feature icon="🚫" title="3 No Deseados" text="Marcá los clubes o selecciones que preferís evitar." />
              <Feature icon="📲" title="WhatsApp 1-Clic" text="Avisos automáticos e instantáneos al celular." />
              <Feature icon="⚡" title="Multidispositivo" text="Entrá desde tu PC o celular con tu misma cuenta." />
            </section>
          </>
        )}

        {/* PANTALLA CREAR EVENTO */}
        {screen === 'create' && (
          <section className="content-layout">
            <div className="form-card">
              <button className="back-link" onClick={() => setScreen('home')}>← Volver al inicio</button>
              <div className="eyebrow">Nuevo sorteo</div>
              <h2>Armemos el partido.</h2>
              <p className="lead">Configurá los datos del evento. Vos serás el organizador.</p>

              {currentUser && (
                <div className="user-bar">
                  <span>Organizador: <strong>{currentUser.display_name}</strong> (@{currentUser.username})</span>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label>Nombre del evento *
                  <input value={eventName} onChange={e => setEventName(e.target.value)} />
                </label>
              </div>

              <DatePickerField
                label="Fecha de entrega / partido"
                value={eventDate}
                onChange={setEventDate}
                helperText="Elegí la fecha desplegando el calendario o con los botones rápidos."
              />

              {/* Configuración expandida del organizador */}
              <div style={{ marginTop: 20, padding: 18, background: '#0a1e12', border: '1px solid #1a4227', borderRadius: 18 }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>⚙️ Configuración de Presupuesto y Reglas</div>

                <div className="form-grid">
                  <label>Presupuesto mínimo ($)
                    <input
                      type="number"
                      inputMode="numeric"
                      value={budgetMin}
                      onChange={e => setBudgetMin(Number(e.target.value))}
                      min={0}
                      step={5000}
                    />
                  </label>
                  <label>Presupuesto máximo ($)
                    <input
                      type="number"
                      inputMode="numeric"
                      value={budgetMax}
                      onChange={e => setBudgetMax(Number(e.target.value))}
                      min={0}
                      step={5000}
                    />
                  </label>
                </div>

                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: '#8aa494' }}>Presets de presupuesto:</span>
                  <div className="preset-group">
                    <button
                      type="button"
                      className={`preset-btn ${budgetMin === 30000 && budgetMax === 60000 ? 'active' : ''}`}
                      onClick={() => { setBudgetMin(30000); setBudgetMax(60000) }}
                    >
                      $30k – $60k (Económico)
                    </button>
                    <button
                      type="button"
                      className={`preset-btn ${budgetMin === 50000 && budgetMax === 100000 ? 'active' : ''}`}
                      onClick={() => { setBudgetMin(50000); setBudgetMax(100000) }}
                    >
                      $50k – $100k (Estándar)
                    </button>
                    <button
                      type="button"
                      className={`preset-btn ${budgetMin === 80000 && budgetMax === 150000 ? 'active' : ''}`}
                      onClick={() => { setBudgetMin(80000); setBudgetMax(150000) }}
                    >
                      $80k – $150k (Oficiales)
                    </button>
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>Tipo de regalo
                    <input
                      value={giftType}
                      onChange={e => setGiftType(e.target.value)}
                      placeholder="Camisetas de fútbol"
                    />
                  </label>
                  <label>Reglas de camisetas / indumentaria
                    <input
                      value={rules}
                      onChange={e => setRules(e.target.value)}
                      placeholder="Ej. Clubes internacionales y selecciones"
                    />
                  </label>
                </div>
              </div>

              <button className="button primary large full" onClick={handleCreateEvent} disabled={busy} style={{ marginTop: 24 }}>
                {busy ? 'Creando evento…' : 'Crear evento e ingresar a la sala →'}
              </button>
            </div>

            <aside className="side-card">
              <div className="side-icon">🏆</div>
              <div className="eyebrow">Tip del organizador</div>
              <h3>Compartí el link directo por WhatsApp.</h3>
              <p>Al crear el evento podrás enviar una invitación con un clic para que todos tus amigos se sumen directamente desde su celular.</p>
            </aside>
          </section>
        )}

        {/* PANTALLA UNIRSE CON CÓDIGO */}
        {screen === 'join' && (
          <section className="content-layout narrow">
            <div className="form-card">
              <button className="back-link" onClick={() => setScreen('home')}>← Volver al inicio</button>
              <div className="eyebrow">Entrar a un evento</div>
              <h2>Sumate al sorteo.</h2>
              <p className="lead">Ingresá el código de 6 letras que te compartieron en el grupo.</p>

              <label>Código del evento *
                <input
                  className="code-input"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\s+/g, '').toUpperCase())}
                  maxLength={6}
                  placeholder="ABC123"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                  autoFocus
                />
              </label>

              <button className="button primary large full" onClick={handleJoinEvent} style={{ marginTop: 20 }}>
                Ir a la sala del evento →
              </button>
            </div>
          </section>
        )}
      </main>

      {/* TOASTS */}
      {message && (
        <div className={`toast ${messageType}`} role="status">
          <span>{messageType === 'error' ? '⚠️' : messageType === 'success' ? '✓' : 'ℹ️'}</span>
          <p>{message}</p>
          <button onClick={() => setMessage('')} aria-label="Cerrar">×</button>
        </div>
      )}

      <footer className="footer">
        <span>⚽ Amigo Invisible · Fulbito</span>
        <span>Misma cuenta en celular y computadora.</span>
      </footer>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="feature-card">
      <span className="feature-icon">{icon}</span>
      <div><strong>{title}</strong><p>{text}</p></div>
    </div>
  )
}
