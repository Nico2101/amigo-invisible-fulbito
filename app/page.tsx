'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Screen = 'home' | 'create' | 'join' | 'prefs' | 'room' | 'result'
type PendingAction =
  | { kind: 'create'; name: string; eventName: string; eventDate: string; email: string }
  | { kind: 'join'; code: string; name: string; email: string }

type EventRow = {
  id: string
  code: string
  name: string
  gift_type: string
  theme: string
  budget_min: number | null
  budget_max: number | null
  event_date: string | null
  rules: string | null
  preference_count: number
  status: 'open' | 'drawn' | 'closed'
  organizer_id: string
}

type MemberRow = {
  event_id: string
  user_id: string
  display_name: string
  role: 'organizer' | 'participant'
  joined_at: string
}

type ResultRow = {
  name: string
  preferences: string[]
}

const supabase = createClient()
const pendingKey = 'amigo-invisible.pending-auth.v3'

function productionUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (configured) return configured
  return window.location.origin
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Ocurrió un error inesperado.')
  if (/invalid.*email/i.test(message)) return 'El email no parece válido.'
  if (/redirect.*url|redirect.*not allowed/i.test(message)) {
    return 'Supabase está rechazando la URL de retorno. Revisá Site URL y Redirect URLs.'
  }
  return message
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home')
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [eventName, setEventName] = useState('Amigo Invisible · Fulbito de los Jueves')
  const [eventDate, setEventDate] = useState('')
  const [code, setCode] = useState('')
  const [event, setEvent] = useState<EventRow | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [prefs, setPrefs] = useState(['', '', ''])
  const [result, setResult] = useState<ResultRow | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info')
  const [busy, setBusy] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [progress, setProgress] = useState({ total: 0, completed: 0, status: 'open' as EventRow['status'] })
  const pendingInFlight = useRef(false)

  const clearMessage = () => setMessage('')

  const notify = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessage(text)
    setMessageType(type)
  }

  const savePending = (pending: PendingAction) => {
    localStorage.setItem(pendingKey, JSON.stringify(pending))
  }

  const readPending = (): PendingAction | null => {
    try {
      const raw = localStorage.getItem(pendingKey)
      return raw ? (JSON.parse(raw) as PendingAction) : null
    } catch {
      localStorage.removeItem(pendingKey)
      return null
    }
  }

  const consumePending = () => {
    const pending = readPending()
    localStorage.removeItem(pendingKey)
    return pending
  }

  const refreshMembers = useCallback(async (eventId: string) => {
    const { data, error } = await supabase
      .from('event_members')
      .select('event_id,user_id,display_name,role,joined_at')
      .eq('event_id', eventId)
      .order('joined_at')

    if (error) throw error
    setMembers((data || []) as MemberRow[])
  }, [])

  const refreshProgress = useCallback(async (eventId: string) => {
    const { data, error } = await supabase.rpc('get_event_progress', { p_event_id: eventId })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    setProgress({
      total: Number(row?.total_members || 0),
      completed: Number(row?.completed_members || 0),
      status: (row?.status || 'open') as EventRow['status'],
    })
  }, [])

  const loadMyResult = useCallback(async (eventId: string) => {
    const { data, error } = await supabase.rpc('get_my_assignment', { p_event_id: eventId })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.recipient_name) {
      throw new Error('Todavía no hay una asignación disponible para tu usuario.')
    }
    setResult({
      name: String(row.recipient_name),
      preferences: Array.isArray(row.preferences) ? row.preferences.map(String) : [],
    })
    setScreen('result')
  }, [])

  const continuePending = useCallback(
    async (authUser: User) => {
      if (pendingInFlight.current) return
      const pending = readPending()
      if (!pending) return
      pendingInFlight.current = true
      localStorage.removeItem(pendingKey)

      try {
        if (pending.kind === 'create') {
          setName(pending.name)
          setEventName(pending.eventName)
          setEventDate(pending.eventDate)
          setEmail(pending.email)
          await createEvent(authUser, pending)
        } else {
          setName(pending.name)
          setCode(pending.code)
          setEmail(pending.email)
          await joinEvent(authUser, pending)
        }
      } catch (error) {
        notify(friendlyError(error), 'error')
        setScreen(pending.kind === 'create' ? 'create' : 'join')
      } finally {
        pendingInFlight.current = false
      }
    },
    [],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('auth_error')
    if (authError) {
      notify(authError, 'error')
      window.history.replaceState({}, '', window.location.pathname)
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) void continuePending(data.user)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
      if (nextUser) void continuePending(nextUser)
    })

    return () => data.subscription.unsubscribe()
  }, [continuePending])

  useEffect(() => {
    if (!event || !user) return
    void refreshMembers(event.id)
    if (event.organizer_id === user.id) {
      void refreshProgress(event.id)
    }
  }, [event?.id, user?.id, refreshMembers, refreshProgress])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 6500)
    return () => window.clearTimeout(timer)
  }, [message])

  async function sendMagicLink(kind: 'create' | 'join') {
    const clean = email.trim().toLowerCase()
    if (!clean) {
      notify('Ingresá tu email para continuar.', 'error')
      return
    }

    if (kind === 'create' && !name.trim()) {
      notify('Ingresá tu nombre antes de continuar.', 'error')
      return
    }

    if (kind === 'join' && (!code.trim() || !name.trim())) {
      notify('Completá código, nombre y email.', 'error')
      return
    }

    setBusy(true)
    setMagicSent(false)
    notify('Preparando tu acceso seguro…')

    const pending: PendingAction =
      kind === 'create'
        ? {
            kind,
            name: name.trim(),
            eventName: eventName.trim(),
            eventDate,
            email: clean,
          }
        : {
            kind,
            code: code.trim().toUpperCase(),
            name: name.trim(),
            email: clean,
          }

    savePending(pending)

    const redirectTo = `${productionUrl()}/auth/callback?next=/`
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    })

    setBusy(false)

    if (error) {
      localStorage.removeItem(pendingKey)
      notify(friendlyError(error), 'error')
      return
    }

    setMagicSent(true)
    notify(
      'Te mandamos el enlace. Abrilo en este mismo navegador para continuar automáticamente.',
      'success',
    )
  }

  async function createEvent(authUser = user, pending?: PendingAction & { kind: 'create' }) {
    if (!authUser) {
      notify('Necesitás ingresar con email antes de crear el evento.', 'error')
      return
    }

    const createName = pending && pending.kind === 'create' ? pending.name : name.trim()
    const createEventName =
      pending && pending.kind === 'create' ? pending.eventName : eventName.trim()
    const createDate = pending && pending.kind === 'create' ? pending.eventDate : eventDate

    if (!createName || !createEventName) {
      setScreen('create')
      notify('Completá tu nombre y el nombre del evento.', 'error')
      return
    }

    setBusy(true)
    clearMessage()

    try {
      const payload = {
        name: createEventName,
        gift_type: 'Camisetas de fútbol',
        theme: 'fulbito',
        budget_min: 50000,
        budget_max: 100000,
        event_date: createDate || null,
        organizer_id: authUser.id,
        code: '',
        preference_count: 3,
        detective_mode: true,
        anonymous_card: true,
        rules: 'Clubes internacionales y selecciones nacionales. No clubes argentinos.',
      }

      let created: EventRow | null = null
      let lastError: Error | null = null

      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        payload.code = crypto
          .getRandomValues(new Uint32Array(3))
          .reduce((acc, value) => `${acc}${value.toString(36)}`, '')
          .slice(0, 6)
          .toUpperCase()

        const { data, error } = await supabase.from('events').insert(payload).select('*').single()
        if (!error) {
          created = data as EventRow
          break
        }
        lastError = error
        if (!/duplicate|unique/i.test(error.message)) break
      }

      if (!created) throw lastError || new Error('No se pudo crear el evento.')

      const { error: memberError } = await supabase.from('event_members').insert({
        event_id: created.id,
        user_id: authUser.id,
        display_name: createName,
        role: 'organizer',
      })

      if (memberError) throw memberError

      setEvent(created)
      setCode(created.code)
      setMembers([
        {
          event_id: created.id,
          user_id: authUser.id,
          display_name: createName,
          role: 'organizer',
          joined_at: new Date().toISOString(),
        },
      ])
      setProgress({ total: 1, completed: 0, status: 'open' })
      setScreen('room')
      notify('Evento creado. Compartí el código con tu grupo.', 'success')
    } catch (error) {
      notify(friendlyError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function joinEvent(authUser = user, pending?: PendingAction & { kind: 'join' }) {
    if (!authUser) {
      notify('Necesitás ingresar con email antes de unirte.', 'error')
      return
    }

    const joinCode = (pending?.kind === 'join' ? pending.code : code).trim().toUpperCase()
    const joinName = (pending?.kind === 'join' ? pending.name : name).trim()

    if (!joinCode || !joinName) {
      setScreen('join')
      notify('Completá código y nombre.', 'error')
      return
    }

    setBusy(true)
    clearMessage()

    try {
      const { data: events, error: lookupError } = await supabase.rpc('lookup_event_by_code', {
        p_code: joinCode,
      })
      if (lookupError) throw lookupError

      const target = Array.isArray(events) ? events[0] : events
      if (!target?.id) throw new Error('No encontré un evento abierto con ese código.')

      const { data: existing } = await supabase
        .from('event_members')
        .select('event_id,user_id')
        .eq('event_id', target.id)
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (!existing) {
        const { error: memberError } = await supabase.from('event_members').insert({
          event_id: target.id,
          user_id: authUser.id,
          display_name: joinName,
          role: 'participant',
        })
        if (memberError) throw memberError
      }

      const { data: fullEvent, error: fullEventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', target.id)
        .single()

      if (fullEventError) throw fullEventError

      setEvent(fullEvent as EventRow)
      setCode(joinCode)
      await refreshMembers(target.id)

      const { data: myPrefs } = await supabase
        .from('preferences')
        .select('position,value')
        .eq('event_id', target.id)
        .eq('user_id', authUser.id)
        .order('position')

      const nextPrefs = ['','','']
      ;(myPrefs || []).forEach((item: { position: number; value: string }) => {
        if (item.position >= 1 && item.position <= 3) nextPrefs[item.position - 1] = item.value
      })
      setPrefs(nextPrefs)
      setScreen(nextPrefs.every(Boolean) ? 'room' : 'prefs')
      notify(
        nextPrefs.every(Boolean)
          ? 'Ya tenías tus preferencias guardadas.'
          : 'Te uniste. Ahora completá tus 3 preferencias.',
        'success',
      )
    } catch (error) {
      notify(friendlyError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function savePreferences() {
    if (!event || !user) return
    const cleaned = prefs.map((value) => value.trim())
    if (cleaned.some((value) => !value)) {
      notify('Completá las 3 preferencias.', 'error')
      return
    }

    setBusy(true)
    try {
      const { error: deleteError } = await supabase
        .from('preferences')
        .delete()
        .eq('event_id', event.id)
        .eq('user_id', user.id)
      if (deleteError) throw deleteError

      const { error } = await supabase.from('preferences').insert(
        cleaned.map((value, index) => ({
          event_id: event.id,
          user_id: user.id,
          position: index + 1,
          value,
        })),
      )
      if (error) throw error

      if (event.organizer_id === user.id) {
        await refreshProgress(event.id)
      }
      setScreen('room')
      notify('Preferencias guardadas.', 'success')
    } catch (error) {
      notify(friendlyError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function draw() {
    if (!event) return

    setBusy(true)
    notify('Cerrando participantes y realizando el sorteo seguro…')

    try {
      const { error } = await supabase.rpc('run_secret_draw', { p_event_id: event.id })
      if (error) throw error
      const { data } = await supabase.from('events').select('*').eq('id', event.id).single()
      if (data) setEvent(data as EventRow)
      await loadMyResult(event.id)
      notify('Sorteo realizado. Tu resultado queda protegido.', 'success')
    } catch (error) {
      notify(friendlyError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setEvent(null)
    setMembers([])
    setResult(null)
    setScreen('home')
    localStorage.removeItem(pendingKey)
    notify('Sesión cerrada.', 'success')
  }

  const isOrganizer = Boolean(user && event && event.organizer_id === user.id)
  const readyToDraw = progress.total >= 2 && progress.completed === progress.total && progress.status === 'open'

  const copyCode = async () => {
    if (!event?.code) return
    try {
      await navigator.clipboard.writeText(event.code)
      notify('Código copiado.', 'success')
    } catch {
      notify(`Copiá el código manualmente: ${event.code}`, 'info')
    }
  }

  const siteLabel = useMemo(() => {
    try {
      return new URL(productionUrl()).hostname.replace(/^www\./, '')
    } catch {
      return 'tu sitio'
    }
  }, [])

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
          {user ? (
            <>
              <span className="user-chip">{user.email}</span>
              <button className="button ghost small-button" onClick={signOut}>Salir</button>
            </>
          ) : (
            <span className="security-note">🔒 Acceso sin contraseña</span>
          )}
        </div>
      </header>

      <main className="page">
        {screen === 'home' && (
          <>
            <section className="hero-card">
              <div className="hero-copy">
                <div className="eyebrow">El clásico del grupo, bien organizado</div>
                <h1>El sorteo de fulbito<br /><span>sin arruinar el misterio.</span></h1>
                <p>
                  Armá el evento, invitá al grupo, carguen sus equipos no deseados y dejá que
                  el sorteo haga el resto. Cada uno ve solamente lo que necesita.
                </p>
                <div className="hero-actions">
                  <button className="button primary large" onClick={() => setScreen('create')}>
                    Crear mi amigo invisible
                  </button>
                  <button className="button secondary large" onClick={() => setScreen('join')}>
                    Tengo un código
                  </button>
                </div>
                <div className="trust-row">
                  <span>✓ Sin contraseñas</span>
                  <span>✓ Sorteo privado</span>
                  <span>✓ Pensado para grupos</span>
                </div>
              </div>
              <div className="hero-visual" aria-hidden="true">
                <div className="pitch-lines" />
                <div className="jersey">10</div>
                <div className="visual-tag">CAMISETA<br /><b>DEL MISTERIO</b></div>
              </div>
            </section>

            <section className="feature-grid">
              <Feature icon="🤫" title="Cruces secretos" text="Nadie puede consultar el sorteo completo." />
              <Feature icon="🚫" title="3 no deseados" text="Cada jugador marca qué equipos no quiere recibir." />
              <Feature icon="📩" title="Login simple" text="Entrás con un enlace mágico enviado a tu email." />
              <Feature icon="📱" title="Celular primero" text="Todo el flujo está pensado para usarlo desde el grupo." />
            </section>

            <section className="how-card">
              <div>
                <div className="eyebrow">Así funciona</div>
                <h2>Cuatro pasos y a jugar.</h2>
              </div>
              <div className="steps">
                <Step n="01" title="Creá" text="Definí nombre y fecha." />
                <Step n="02" title="Invitá" text="Compartí el código." />
                <Step n="03" title="Elegí" text="Cada uno carga 3 no deseados." />
                <Step n="04" title="Sorteá" text="Cada uno recibe su secreto." />
              </div>
            </section>
          </>
        )}

        {screen === 'create' && (
          <section className="content-layout">
            <div className="form-card">
              <button className="back-link" onClick={() => setScreen('home')}>← Volver al inicio</button>
              <div className="eyebrow">Nuevo evento</div>
              <h2>Armemos el partido.</h2>
              <p className="lead">Completá lo esencial. Después compartís el código con el grupo.</p>

              {!user && (
                <div className="auth-panel">
                  <div className="auth-icon">✉</div>
                  <div>
                    <h3>Primero aseguramos tu identidad</h3>
                    <p>Te mandamos un enlace de acceso a tu email. No necesitás crear una contraseña.</p>
                  </div>
                  <label>
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="vos@email.com" autoComplete="email" />
                  </label>
                  <button className="button primary full" onClick={() => sendMagicLink('create')} disabled={busy}>
                    {busy ? 'Enviando enlace…' : magicSent ? 'Enviar otro enlace' : 'Enviar enlace de acceso'}
                  </button>
                  {magicSent && (
                    <div className="magic-tip">
                      <strong>Revisá tu bandeja.</strong>
                      <span>El enlace te devolverá a <b>{siteLabel}</b> y retomará este paso.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="form-grid">
                <label>
                  Tu nombre
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
                </label>
                <label>
                  Nombre del evento
                  <input value={eventName} onChange={(e) => setEventName(e.target.value)} />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Fecha de entrega
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </label>
                <div className="readonly-card">
                  <span>Presupuesto</span>
                  <strong>$50.000 – $100.000</strong>
                  <small>Configurado para este evento.</small>
                </div>
              </div>

              <div className="rule-box">
                <span>⚽</span>
                <div>
                  <strong>Regla del fulbito</strong>
                  <p>Clubes internacionales y selecciones. No clubes argentinos.</p>
                </div>
              </div>

              <button className="button primary large full" onClick={() => (user ? createEvent() : notify('Ingresá primero desde el bloque de acceso.', 'error'))} disabled={busy}>
                {busy ? 'Creando evento…' : 'Crear evento →'}
              </button>
            </div>

            <aside className="side-card">
              <div className="side-icon">🏆</div>
              <div className="eyebrow">Tip del organizador</div>
              <h3>Compartí el código apenas se cree.</h3>
              <p>El código es corto, fácil de copiar al grupo de WhatsApp y no revela ningún cruce.</p>
            </aside>
          </section>
        )}

        {screen === 'join' && (
          <section className="content-layout narrow">
            <div className="form-card">
              <button className="back-link" onClick={() => setScreen('home')}>← Volver al inicio</button>
              <div className="eyebrow">Entrar a un evento</div>
              <h2>Te sumás en dos minutos.</h2>
              <p className="lead">Necesitamos tu nombre, el código del evento y tu email para proteger tu resultado.</p>

              <label>
                Código del evento
                <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC123" />
              </label>
              <div className="form-grid">
                <label>
                  Tu nombre
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
                </label>
                <label>
                  Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" autoComplete="email" />
                </label>
              </div>

              {user ? (
                <button className="button primary large full" onClick={() => joinEvent()} disabled={busy}>
                  {busy ? 'Entrando…' : 'Unirme al evento →'}
                </button>
              ) : (
                <>
                  <button className="button primary large full" onClick={() => sendMagicLink('join')} disabled={busy}>
                    {busy ? 'Enviando enlace…' : magicSent ? 'Enviar otro enlace' : 'Enviar acceso por email'}
                  </button>
                  {magicSent && (
                    <div className="magic-tip">
                      <strong>Listo.</strong>
                      <span>Abrí el email en este navegador y volveremos al evento automáticamente.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {screen === 'prefs' && (
          <section className="content-layout narrow">
            <div className="form-card">
              <div className="step-badge">02 / 03</div>
              <div className="eyebrow">Preferencias</div>
              <h2>Decinos qué NO querés.</h2>
              <p className="lead">Tus preferencias se guardan de forma privada. El resto del grupo no puede verlas.</p>

              {prefs.map((value, index) => (
                <label key={index} className="pref-field">
                  <span>🚫 No deseado #{index + 1}</span>
                  <input
                    value={value}
                    onChange={(e) => setPrefs((current) => current.map((item, i) => (i === index ? e.target.value : item)))}
                    placeholder={['Ej. Real Madrid', 'Ej. Brasil', 'Ej. Manchester United'][index]}
                  />
                </label>
              ))}

              <button className="button primary large full" onClick={savePreferences} disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar preferencias →'}
              </button>
            </div>
          </section>
        )}

        {screen === 'room' && event && (
          <section className="room">
            <div className="room-head">
              <div>
                <div className="eyebrow">Sala del evento</div>
                <h2>{event.name}</h2>
                <p>{event.event_date ? `Entrega · ${new Date(`${event.event_date}T12:00:00`).toLocaleDateString('es-AR')}` : 'Fecha de entrega pendiente'}</p>
              </div>
              <div className="code-card">
                <span>Código</span>
                <strong>{event.code}</strong>
                <button onClick={copyCode}>Copiar</button>
              </div>
            </div>

            <div className="room-grid">
              <div className="member-card">
                <div className="section-title">
                  <div>
                    <span className="eyebrow">Plantel</span>
                    <h3>{members.length} participante{members.length === 1 ? '' : 's'}</h3>
                  </div>
                  {isOrganizer && <span className={`status-chip ${readyToDraw ? 'ready' : ''}`}>{readyToDraw ? 'Listo para sortear' : 'Esperando al grupo'}</span>}
                </div>

                <div className="member-list">
                  {members.map((member) => (
                    <div className="member-row" key={`${member.event_id}-${member.user_id}`}>
                      <div className="avatar">{member.display_name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>{member.display_name}</strong>
                        <span>{member.role === 'organizer' ? 'Organizador' : 'Participante'}</span>
                      </div>
                      <span className="secure-state">🔒</span>
                    </div>
                  ))}
                </div>

                {isOrganizer && (
                  <div className="draw-panel">
                    <div>
                      <strong>Estado del grupo</strong>
                      <p>{progress.completed} de {progress.total} personas completaron sus preferencias.</p>
                    </div>
                    <button className="button primary" onClick={draw} disabled={!readyToDraw || busy || event.status !== 'open'}>
                      {event.status === 'drawn' ? 'Sorteo realizado' : busy ? 'Sorteando…' : '🎲 Realizar sorteo'}
                    </button>
                  </div>
                )}

                {!isOrganizer && event.status === 'drawn' && (
                  <button className="button primary large full" onClick={() => loadMyResult(event.id)} disabled={busy}>
                    🎁 Ver mi resultado
                  </button>
                )}
              </div>

              <aside className="info-card">
                <div className="big-lock">🔐</div>
                <div className="eyebrow">Privacidad</div>
                <h3>El organizador tampoco puede ver los cruces.</h3>
                <p>Supabase valida la identidad y entrega a cada participante solamente su asignación.</p>
              </aside>
            </div>
          </section>
        )}

        {screen === 'result' && event && result && (
          <section className="result-page">
            <div className="result-hero">
              <div className="step-badge">03 / 03</div>
              <div className="eyebrow">Tu resultado secreto</div>
              <h2>Te toca regalarle a…</h2>
              <div className="recipient">{result.name}</div>
              <p>Guardá el misterio. Este resultado es solamente tuyo.</p>
            </div>

            <div className="result-grid">
              <div className="result-card">
                <span>🚫 NO DESEADOS</span>
                <h3>Ayudá a elegir mejor.</h3>
                <div className="chip-list">
                  {result.preferences.length ? result.preferences.map((item) => <span key={item}>{item}</span>) : <span>Sin preferencias</span>}
                </div>
              </div>
              <div className="result-card">
                <span>💰 PRESUPUESTO</span>
                <h3>$50.000 – $100.000</h3>
                <p>Una camiseta para que el intercambio tenga sentido.</p>
              </div>
              <div className="result-card">
                <span>📅 ENTREGA</span>
                <h3>{event.event_date ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString('es-AR') : 'A confirmar'}</h3>
                <p>Guardá la fecha y llegá con tiempo.</p>
              </div>
            </div>

            <button className="button secondary large" onClick={() => setScreen('room')}>← Volver a la sala</button>
          </section>
        )}
      </main>

      {message && (
        <div className={`toast ${messageType}`} role="status">
          <span>{messageType === 'error' ? '⚠️' : messageType === 'success' ? '✓' : 'ℹ️'}</span>
          <p>{message}</p>
          <button onClick={() => setMessage('')} aria-label="Cerrar">×</button>
        </div>
      )}

      <footer className="footer">
        <span>⚽ Amigo Invisible · Fulbito</span>
        <span>Hecho para amigos, asados y camisetas.</span>
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

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return <div className="step"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>
}
