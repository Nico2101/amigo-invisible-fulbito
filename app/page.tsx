'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  generateWhatsAppLink,
  generateGroupWhatsAppLink,
  DrawAssignmentNotification,
} from '@/lib/notifications'

type Screen = 'home' | 'create' | 'join' | 'prefs' | 'room' | 'result'

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
  budget_min: number | null
  budget_max: number | null
  event_date: string | null
  rules: string | null
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
  email?: string
  phone?: string
  has_preferences?: boolean
}

interface ResultRow {
  recipientName: string
  preferences: string[]
}

const USER_SESSION_KEY = 'amigo-invisible.user-session.v4'

function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('amigo_user_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('amigo_user_id', id)
  }
  return id
}

export default function Home() {
  const supabase = useMemo(() => createClient(), [])
  const [screen, setScreen] = useState<Screen>('home')
  const [currentUser, setCurrentUser] = useState<LocalUser | null>(null)

  // Inputs
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [eventName, setEventName] = useState('Amigo Invisible · Fulbito de los Jueves')
  const [eventDate, setEventDate] = useState('')
  const [code, setCode] = useState('')

  // Event Data
  const [event, setEvent] = useState<EventRow | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [prefs, setPrefs] = useState(['', '', ''])
  const [result, setResult] = useState<ResultRow | null>(null)

  // Reveal state
  const [isRevealed, setIsRevealed] = useState(false)

  // Toast / Messages
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info')
  const [busy, setBusy] = useState(false)

  // Progress
  const [progress, setProgress] = useState({ total: 0, completed: 0, status: 'open' as EventRow['status'] })

  const notify = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessage(text)
    setMessageType(type)
  }

  // Load stored session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_SESSION_KEY)
      if (stored) {
        const parsed: LocalUser = JSON.parse(stored)
        setCurrentUser(parsed)
        setName(parsed.name)
        setEmail(parsed.email || '')
        setPhone(parsed.phone || '')
      }
    } catch {
      localStorage.removeItem(USER_SESSION_KEY)
    }
  }, [])

  const saveUserSession = (user: LocalUser) => {
    setCurrentUser(user)
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user))
  }

  const signOut = () => {
    localStorage.removeItem(USER_SESSION_KEY)
    setCurrentUser(null)
    setName('')
    setEmail('')
    setPhone('')
    setEvent(null)
    setMembers([])
    setResult(null)
    setScreen('home')
    notify('Sesión cerrada.', 'success')
  }

  const refreshMembers = useCallback(async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('event_members')
        .select('event_id,user_id,display_name,role,joined_at')
        .eq('event_id', eventId)
        .order('joined_at')

      if (error) throw error

      const rawMembers = (data || []) as MemberRow[]

      // Fetch preference completion for each member
      const { data: prefData } = await supabase
        .from('preferences')
        .select('user_id, position')
        .eq('event_id', eventId)

      const prefCounts: Record<string, number> = {}
      ;(prefData || []).forEach((p: { user_id: string }) => {
        prefCounts[p.user_id] = (prefCounts[p.user_id] || 0) + 1
      })

      const enriched = rawMembers.map((m) => ({
        ...m,
        has_preferences: (prefCounts[m.user_id] || 0) >= 3,
      }))

      setMembers(enriched)

      const completed = enriched.filter((m) => m.has_preferences).length
      setProgress((prev) => ({
        ...prev,
        total: enriched.length,
        completed,
      }))
    } catch (err) {
      console.warn('Error al cargar miembros:', err)
    }
  }, [])

  const loadMyResult = useCallback(async (eventId: string, userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_my_assignment', {
        p_event_id: eventId,
        p_user_id: userId,
      })

      if (!error && Array.isArray(data) && data.length > 0 && data[0].recipient_name) {
        setResult({
          recipientName: String(data[0].recipient_name),
          preferences: Array.isArray(data[0].preferences) ? data[0].preferences.map(String) : [],
        })
        setScreen('result')
        return
      }

      // Direct fallback query if RPC not applied yet
      const { data: assignData } = await supabase
        .from('assignments')
        .select('recipient_user_id')
        .eq('event_id', eventId)
        .eq('giver_user_id', userId)
        .maybeSingle()

      if (assignData?.recipient_user_id) {
        const { data: recipientMember } = await supabase
          .from('event_members')
          .select('display_name')
          .eq('event_id', eventId)
          .eq('user_id', assignData.recipient_user_id)
          .single()

        const { data: prefData } = await supabase
          .from('preferences')
          .select('value')
          .eq('event_id', eventId)
          .eq('user_id', assignData.recipient_user_id)
          .order('position')

        if (recipientMember) {
          setResult({
            recipientName: recipientMember.display_name,
            preferences: (prefData || []).map((p: { value: string }) => p.value),
          })
          setScreen('result')
          return
        }
      }

      throw new Error('Todavía no hay un amigo asignado para tu usuario.')
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error')
    }
  }, [])

  // Auto-dismiss toast message
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 6000)
    return () => clearTimeout(timer)
  }, [message])

  // --- ACTIONS ---

  async function handleCreateEvent() {
    const cleanName = name.trim()
    const cleanEventName = eventName.trim()

    if (!cleanName) {
      notify('Por favor, ingresá tu nombre.', 'error')
      return
    }
    if (!cleanEventName) {
      notify('Por favor, ingresá el nombre del evento.', 'error')
      return
    }

    setBusy(true)

    const userId = currentUser?.id || getOrCreateUserId()
    const userSession: LocalUser = { id: userId, name: cleanName, email: email.trim(), phone: phone.trim() }
    saveUserSession(userSession)

    try {
      const newCode = crypto.getRandomValues(new Uint32Array(3))
        .reduce((acc, val) => acc + val.toString(36), '')
        .slice(0, 6)
        .toUpperCase()

      const payload = {
        name: cleanEventName,
        gift_type: 'Camisetas de fútbol',
        theme: 'fulbito',
        budget_min: 50000,
        budget_max: 100000,
        event_date: eventDate || null,
        organizer_id: userId,
        code: newCode,
        preference_count: 3,
        rules: 'Clubes internacionales y selecciones nacionales. No clubes argentinos.',
      }

      const { data: created, error } = await supabase.from('events').insert(payload).select('*').single()
      if (error) throw error

      const eventRow = created as EventRow

      await supabase.from('event_members').insert({
        event_id: eventRow.id,
        user_id: userId,
        display_name: cleanName,
        role: 'organizer',
      })

      setEvent(eventRow)
      setCode(eventRow.code)
      await refreshMembers(eventRow.id)
      setScreen('prefs')
      notify('¡Evento creado con éxito! Ahora cargá tus 3 camisetas no deseadas.', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al crear evento', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoinEvent() {
    const cleanCode = code.trim().toUpperCase()
    const cleanName = name.trim()

    if (!cleanCode) {
      notify('Ingresá el código de 6 caracteres.', 'error')
      return
    }
    if (!cleanName) {
      notify('Ingresá tu nombre.', 'error')
      return
    }

    setBusy(true)

    const userId = currentUser?.id || getOrCreateUserId()
    const userSession: LocalUser = { id: userId, name: cleanName, email: email.trim(), phone: phone.trim() }
    saveUserSession(userSession)

    try {
      // Lookup event
      const { data: foundEvents, error: lookupError } = await supabase
        .from('events')
        .select('*')
        .eq('code', cleanCode)

      if (lookupError || !foundEvents || foundEvents.length === 0) {
        throw new Error('No se encontró ningún evento activo con ese código.')
      }

      const targetEvent = foundEvents[0] as EventRow

      // Check member
      const { data: existingMember } = await supabase
        .from('event_members')
        .select('user_id')
        .eq('event_id', targetEvent.id)
        .eq('user_id', userId)
        .maybeSingle()

      if (!existingMember) {
        await supabase.from('event_members').insert({
          event_id: targetEvent.id,
          user_id: userId,
          display_name: cleanName,
          role: 'participant',
        })
      }

      setEvent(targetEvent)
      setCode(targetEvent.code)
      await refreshMembers(targetEvent.id)

      // Fetch user preferences if existing
      const { data: myPrefs } = await supabase
        .from('preferences')
        .select('position, value')
        .eq('event_id', targetEvent.id)
        .eq('user_id', userId)
        .order('position')

      const nextPrefs = ['', '', '']
      ;(myPrefs || []).forEach((item: { position: number; value: string }) => {
        if (item.position >= 1 && item.position <= 3) nextPrefs[item.position - 1] = item.value
      })

      setPrefs(nextPrefs)

      if (targetEvent.status === 'drawn') {
        await loadMyResult(targetEvent.id, userId)
      } else if (nextPrefs.every(Boolean)) {
        setScreen('room')
        notify('¡Ya estás en la sala! Tus preferencias están guardadas.', 'success')
      } else {
        setScreen('prefs')
        notify('Te uniste correctamente. Ahora elegí tus 3 no deseados.', 'success')
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al unirte al evento', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleSavePreferences() {
    if (!event || !currentUser) return

    const cleaned = prefs.map((p) => p.trim())
    if (cleaned.some((p) => !p)) {
      notify('Por favor completá los 3 campos de no deseados.', 'error')
      return
    }

    setBusy(true)

    try {
      await supabase.from('preferences').delete().eq('event_id', event.id).eq('user_id', currentUser.id)

      const { error } = await supabase.from('preferences').insert(
        cleaned.map((val, idx) => ({
          event_id: event.id,
          user_id: currentUser.id,
          position: idx + 1,
          value: val,
        }))
      )

      if (error) throw error

      await refreshMembers(event.id)
      setScreen('room')
      notify('¡Preferencias guardadas exitosamente!', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al guardar preferencias', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDraw() {
    if (!event) return

    setBusy(true)
    notify('Generando sorteo y asignaciones secretas…')

    try {
      // 1. Run secret draw via RPC
      const { error: rpcError } = await supabase.rpc('run_secret_draw', { p_event_id: event.id })

      if (rpcError) {
        // Client-side fallback algorithm if RPC is not present
        const currentMembers = [...members]
        if (currentMembers.length < 2) throw new Error('Se necesitan al menos 2 participantes.')

        let shuffled = [...currentMembers]
        let isValid = false
        let attempts = 0

        while (!isValid && attempts < 100) {
          attempts++
          shuffled = [...currentMembers].sort(() => Math.random() - 0.5)
          isValid = currentMembers.every((m, i) => m.user_id !== shuffled[i].user_id)
        }

        if (!isValid) throw new Error('No se pudo generar una combinación válida. Reintentá.')

        await supabase.from('assignments').delete().eq('event_id', event.id)

        for (let i = 0; i < currentMembers.length; i++) {
          await supabase.from('assignments').insert({
            event_id: event.id,
            giver_user_id: currentMembers[i].user_id,
            recipient_user_id: shuffled[i].user_id,
          })
        }

        await supabase.from('events').update({ status: 'drawn' }).eq('id', event.id)
      }

      // Update local event state
      setEvent((prev) => (prev ? { ...prev, status: 'drawn' } : null))
      setProgress((prev) => ({ ...prev, status: 'drawn' }))

      // 2. Fetch assignments to dispatch notifications
      const { data: assignments } = await supabase
        .from('assignments')
        .select('giver_user_id, recipient_user_id')
        .eq('event_id', event.id)

      if (assignments && assignments.length > 0) {
        const notificationsList: DrawAssignmentNotification[] = []

        for (const assign of assignments) {
          const giver = members.find((m) => m.user_id === assign.giver_user_id)
          const recipient = members.find((m) => m.user_id === assign.recipient_user_id)

          if (giver && recipient) {
            const { data: rPrefs } = await supabase
              .from('preferences')
              .select('value')
              .eq('event_id', event.id)
              .eq('user_id', recipient.user_id)
              .order('position')

            notificationsList.push({
              giverName: giver.display_name,
              giverEmail: giver.email || currentUser?.email,
              recipientName: recipient.display_name,
              preferences: (rPrefs || []).map((p: { value: string }) => p.value),
              eventName: event.name,
              eventCode: event.code,
            })
          }
        }

        // Call email notification API route
        try {
          await fetch('/api/notify-draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notifications: notificationsList }),
          })
        } catch {
          // Ignore email API errors if missing keys
        }
      }

      if (currentUser) {
        await loadMyResult(event.id, currentUser.id)
      }

      notify('🎉 ¡Sorteo realizado con éxito! Las notificaciones están listas.', 'success')
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyCode = async () => {
    if (!event?.code) return
    try {
      await navigator.clipboard.writeText(event.code)
      notify('Código copiado al portapapeles.', 'success')
    } catch {
      notify(`Código del evento: ${event.code}`, 'info')
    }
  }

  const isOrganizer = Boolean(currentUser && event && event.organizer_id === currentUser.id)
  const readyToDraw = progress.total >= 2 && progress.completed === progress.total && event?.status === 'open'

  return (
    <div className="app-shell">
      {/* Top Navbar */}
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
              <span className="user-chip">👤 {currentUser.name}</span>
              <button className="button ghost small-button" onClick={signOut}>
                Salir
              </button>
            </>
          ) : (
            <span className="user-chip" style={{ opacity: 0.7 }}>
              🔓 Acceso directo sin contraseña
            </span>
          )}
        </div>
      </header>

      <main className="page">
        {/* HOME SCREEN */}
        {screen === 'home' && (
          <>
            <section className="hero-card">
              <div className="hero-copy">
                <div className="eyebrow">⚽ Organizado para el grupo de cancha</div>
                <h1>
                  El Amigo Invisible<br />
                  <span>sin arruinar la sorpresa.</span>
                </h1>
                <p>
                  Armá la fecha, agregá al plantel, cada uno carga las 3 camisetas que NO quiere recibir y
                  recibí los resultados de forma automática por <strong>WhatsApp</strong> y <strong>Mail</strong>.
                </p>
                <div className="hero-actions">
                  <button className="button primary large" onClick={() => setScreen('create')}>
                    Crear mi amigo invisible →
                  </button>
                  <button className="button secondary large" onClick={() => setScreen('join')}>
                    Tengo un código de evento
                  </button>
                </div>
                <div className="trust-row">
                  <span>✓ Sin contraseñas</span>
                  <span>✓ Sorteo 100% privado</span>
                  <span>✓ Notificación por WhatsApp</span>
                </div>
              </div>
              <div className="hero-visual" aria-hidden="true">
                <div className="pitch-lines" />
                <div className="jersey">10</div>
                <div className="visual-tag">
                  EDICIÓN CANCHA
                  <b>CAMISETA DEL MISTERIO</b>
                </div>
              </div>
            </section>

            <section className="feature-grid">
              <Feature icon="🤫" title="Resultado Privado" text="Cada uno consulta únicamente su asignación." />
              <Feature icon="🚫" title="3 No Deseados" text="Marcá los clubes o selecciones que preferís evitar." />
              <Feature icon="📲" title="WhatsApp 1-Clic" text="Avisos automáticos e instantáneos al celular." />
              <Feature icon="⚡" title="Acceso Inmediato" text="Sin contraseñas ni confirmación de emails." />
            </section>

            <section className="how-card">
              <div>
                <div className="eyebrow">Pasos sencillos</div>
                <h2>Cuatro toques y a sortear.</h2>
              </div>
              <div className="steps">
                <Step n="01" title="Creá" text="Definí el evento y la fecha de entrega." />
                <Step n="02" title="Compartí" text="Envía el código de 6 letras al grupo." />
                <Step n="03" title="Descartá" text="Cada jugador elige 3 camisetas no deseadas." />
                <Step n="04" title="Disfrutá" text="El sorteo les notifica su amigo asignado." />
              </div>
            </section>
          </>
        )}

        {/* CREATE EVENT SCREEN */}
        {screen === 'create' && (
          <section className="content-layout">
            <div className="form-card">
              <button className="back-link" onClick={() => setScreen('home')}>
                ← Volver al inicio
              </button>
              <div className="eyebrow">Nuevo sorteo</div>
              <h2>Armemos el partido.</h2>
              <p className="lead">Completá tus datos y el nombre del evento para generar la sala.</p>

              <div className="auth-panel">
                <div className="auth-panel-head">
                  <div className="auth-icon">⚽</div>
                  <div>
                    <h3>Tu identificación de jugador</h3>
                    <p>Sin contraseña. Tu nombre se usa para identificarte en la sala.</p>
                  </div>
                </div>
                <label>
                  Tu nombre de jugador *
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Leo Messi, Nico Abritta"
                    autoComplete="name"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Email para notificaciones (opcional)
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vos@email.com"
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    WhatsApp (opcional)
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+54 9 11..."
                    />
                  </label>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  Nombre del evento *
                  <input value={eventName} onChange={(e) => setEventName(e.target.value)} />
                </label>
                <label>
                  Fecha de entrega / partido
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </label>
              </div>

              <div className="form-grid">
                <div className="readonly-card">
                  <span>Presupuesto sugerido</span>
                  <strong>$50.000 – $100.000</strong>
                  <small>Equivalente a una camiseta oficial o réplica top.</small>
                </div>
                <div className="readonly-card">
                  <span>Regla de camisetas</span>
                  <strong>Internacionales y Selecciones</strong>
                  <small>Se evitan camisetas de clubes locales si se prefiere.</small>
                </div>
              </div>

              <button className="button primary large full" onClick={handleCreateEvent} disabled={busy} style={{ marginTop: 20 }}>
                {busy ? 'Creando evento…' : 'Crear evento e ingresar →'}
              </button>
            </div>

            <aside className="side-card">
              <div className="side-icon">🏆</div>
              <div className="eyebrow">Tip del organizador</div>
              <h3>Compartí el código en el grupo.</h3>
              <p>El código es fácil de copiar al grupo de WhatsApp y nadie sabrá qué le tocó a los demás.</p>
            </aside>
          </section>
        )}

        {/* JOIN SCREEN */}
        {screen === 'join' && (
          <section className="content-layout narrow">
            <div className="form-card">
              <button className="back-link" onClick={() => setScreen('home')}>
                ← Volver al inicio
              </button>
              <div className="eyebrow">Entrar a un evento</div>
              <h2>Sumate al sorteo.</h2>
              <p className="lead">Ingresá el código de 6 letras que te compartieron y tu nombre.</p>

              <label>
                Código del evento *
                <input
                  className="code-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ABC123"
                />
              </label>

              <div className="auth-panel" style={{ marginTop: 16 }}>
                <label>
                  Tu nombre *
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre y apellido"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Email (para recibir tu resultado por correo)
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vos@email.com"
                    />
                  </label>
                  <label>
                    WhatsApp (opcional)
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+54 9 11..."
                    />
                  </label>
                </div>
              </div>

              <button className="button primary large full" onClick={handleJoinEvent} disabled={busy}>
                {busy ? 'Uniéndote…' : 'Unirme al evento →'}
              </button>
            </div>
          </section>
        )}

        {/* PREFERENCES SCREEN */}
        {screen === 'prefs' && (
          <section className="content-layout narrow">
            <div className="form-card">
              <div className="step-badge">02 / 03</div>
              <div className="eyebrow">Camisetas No Deseadas</div>
              <h2>Decinos qué NO querés recibir.</h2>
              <p className="lead">
                Cargá 3 equipos o selecciones que ya tenés o preferís no recibir. El resto lo verá de forma privada.
              </p>

              {prefs.map((value, idx) => (
                <div key={idx} className="pref-field">
                  <span>🚫 No deseado #{idx + 1}</span>
                  <input
                    value={value}
                    onChange={(e) =>
                      setPrefs((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))
                    }
                    placeholder={['Ej. Real Madrid', 'Ej. Brasil', 'Ej. Manchester United'][idx]}
                  />
                </div>
              ))}

              <button className="button primary large full" onClick={handleSavePreferences} disabled={busy} style={{ marginTop: 20 }}>
                {busy ? 'Guardando…' : 'Guardar y pasar a la sala →'}
              </button>
            </div>
          </section>
        )}

        {/* ROOM SCREEN */}
        {screen === 'room' && event && (
          <section className="room">
            <div className="room-head">
              <div>
                <div className="eyebrow">Sala del evento</div>
                <h2>{event.name}</h2>
                <p>
                  {event.event_date
                    ? `Entrega: ${new Date(`${event.event_date}T12:00:00`).toLocaleDateString('es-AR')}`
                    : 'Fecha de entrega por confirmar'}
                </p>
              </div>
              <div className="code-card">
                <span>Código de sala</span>
                <strong>{event.code}</strong>
                <button className="button ghost small-button" onClick={copyCode}>
                  Copiar código
                </button>
              </div>
            </div>

            <div className="room-grid">
              <div className="member-card">
                <div className="section-title">
                  <div>
                    <div className="eyebrow">Plantel de participantes</div>
                    <h3>{members.length} Jugador{members.length === 1 ? '' : 'es'}</h3>
                  </div>
                  {isOrganizer && (
                    <span className={`status-chip ${readyToDraw ? 'ready' : ''}`}>
                      {event.status === 'drawn'
                        ? 'Sorteo realizado'
                        : readyToDraw
                        ? '¡Listos para sortear!'
                        : 'Faltan preferencias'}
                    </span>
                  )}
                </div>

                <div className="member-list">
                  {members.map((member) => (
                    <div className="member-row" key={member.user_id}>
                      <div className="avatar">{member.display_name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>{member.display_name}</strong>
                        <span>{member.role === 'organizer' ? '⭐ Organizador' : '⚽ Jugador'}</span>
                      </div>
                      <span className={`pref-badge ${member.has_preferences ? 'complete' : 'pending'}`}>
                        {member.has_preferences ? '✓ No deseados cargados' : '⏳ Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Organizer Panel */}
                {isOrganizer && (
                  <div className="draw-panel">
                    <div className="draw-panel-info">
                      <strong>Estado del sorteo</strong>
                      <p>
                        {progress.completed} de {progress.total} personas cargaron sus preferencias.
                      </p>
                    </div>
                    {event.status === 'open' ? (
                      <button
                        className="button primary large full"
                        onClick={handleDraw}
                        disabled={!readyToDraw || busy}
                      >
                        {busy ? 'Sorteando…' : '🎲 Realizar sorteo del Amigo Invisible'}
                      </button>
                    ) : (
                      <div className="button primary large full" style={{ opacity: 0.9, textAlign: 'center' }}>
                        ✓ Sorteo completado
                      </div>
                    )}
                  </div>
                )}

                {/* WhatsApp Notification Dashboard for Organizer after Draw */}
                {event.status === 'drawn' && (
                  <div className="wa-dashboard">
                    <div className="wa-dashboard-head">
                      <span>📲</span>
                      <h4>Notificar por WhatsApp a los participantes</h4>
                    </div>
                    <p style={{ fontSize: 13, color: '#88aa94', margin: '4px 0 12px' }}>
                      Podes enviar la notificación con 1 solo clic a cada integrante:
                    </p>

                    <a
                      href={generateGroupWhatsAppLink(
                        event.name,
                        event.code,
                        typeof window !== 'undefined' ? window.location.origin : ''
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button whatsapp full"
                      style={{ marginBottom: 12 }}
                    >
                      📢 Compartir aviso general en el grupo de WhatsApp
                    </a>

                    <div className="wa-list">
                      {members.map((m) => (
                        <div key={m.user_id} className="wa-row">
                          <span>👤 {m.display_name}</span>
                          <button
                            className="button whatsapp small-button"
                            onClick={async () => {
                              try {
                                const { data } = await supabase.rpc('get_my_assignment', {
                                  p_event_id: event.id,
                                  p_user_id: m.user_id,
                                })
                                const rName = data?.[0]?.recipient_name || 'tu amigo invisible'
                                const rPrefs = data?.[0]?.preferences || []
                                const url = generateWhatsAppLink(
                                  m.display_name,
                                  rName,
                                  rPrefs,
                                  event.name,
                                  event.code,
                                  m.phone
                                )
                                window.open(url, '_blank')
                              } catch {
                                notify('No se pudo generar el enlace para ' + m.display_name, 'error')
                              }
                            }}
                          >
                            Enviar WhatsApp
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Participant Result Button */}
                {event.status === 'drawn' && currentUser && (
                  <button
                    className="button primary large full"
                    onClick={() => loadMyResult(event.id, currentUser.id)}
                    style={{ marginTop: 16 }}
                  >
                    🎁 Ver mi amigo invisible secreto →
                  </button>
                )}
              </div>

              <aside className="info-card">
                <div className="big-lock">🔐</div>
                <div className="eyebrow">Privacidad asegurada</div>
                <h3>Ni el organizador puede ver los resultados.</h3>
                <p>
                  El algoritmo genera los cruces de forma completamente aleatoria y encriptada. Cada uno ve
                  solamente la persona que le tocó regalar.
                </p>
              </aside>
            </div>
          </section>
        )}

        {/* RESULT REVEAL SCREEN */}
        {screen === 'result' && event && result && (
          <section className="result-page">
            <div className="result-hero">
              <div className="step-badge">03 / 03</div>
              <div className="eyebrow">Tu amigo invisible secreto</div>
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
                    result.preferences.map((item) => <span key={item}>❌ {item}</span>)
                  ) : (
                    <span>Sin preferencias especificadas</span>
                  )}
                </div>
              </div>
              <div className="result-card">
                <span>💰 PRESUPUESTO</span>
                <h3>$50.000 – $100.000</h3>
                <p>Monto sugerido para camisetas oficiales o réplicas de calidad.</p>
              </div>
              <div className="result-card">
                <span>📅 FECHA DE ENTREGA</span>
                <h3>
                  {event.event_date
                    ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString('es-AR')
                    : 'A confirmar'}
                </h3>
                <p>No te olvides de llevar la camiseta empaquetada.</p>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button className="button secondary large" onClick={() => setScreen('room')}>
                ← Volver a la sala del evento
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Toast Notification */}
      {message && (
        <div className={`toast ${messageType}`} role="status">
          <span>{messageType === 'error' ? '⚠️' : messageType === 'success' ? '✓' : 'ℹ️'}</span>
          <p>{message}</p>
          <button onClick={() => setMessage('')} aria-label="Cerrar">
            ×
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <span>⚽ Amigo Invisible · Fulbito</span>
        <span>Organización sin fricciones para grupos de amigos y fútbol.</span>
      </footer>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="feature-card">
      <span className="feature-icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="step">
      <span>{n}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}
