// Almacenamiento en memoria del servidor de Next.js.
// Compartido entre todas las peticiones mientras el proceso de Node esté vivo.
// Funciona perfecto con `npm run dev` y `npm start` (un solo proceso).

export interface StoreEvent {
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
  created_at: string
}

export interface StoreMember {
  event_id: string
  user_id: string
  display_name: string
  role: 'organizer' | 'participant'
  joined_at: string
}

export interface StorePreference {
  event_id: string
  user_id: string
  position: number
  value: string
}

export interface StoreAssignment {
  event_id: string
  giver_user_id: string
  recipient_user_id: string
}

// ---- Singleton Maps (viven en el proceso del server) ----

const events = new Map<string, StoreEvent>()          // id → event
const eventsByCode = new Map<string, string>()         // code → id
const membersByEvent = new Map<string, StoreMember[]>()
const prefsByEvent = new Map<string, StorePreference[]>()
const assignmentsByEvent = new Map<string, StoreAssignment[]>()

// ---- Funciones públicas ----

export function createEvent(ev: StoreEvent): StoreEvent {
  events.set(ev.id, ev)
  eventsByCode.set(ev.code.toUpperCase(), ev.id)
  console.log(`[Store] Evento creado: ${ev.name} (${ev.code}), id=${ev.id}`)
  return ev
}

export function getEventByCode(code: string): StoreEvent | null {
  const id = eventsByCode.get(code.toUpperCase())
  if (!id) return null
  return events.get(id) || null
}

export function getEventById(id: string): StoreEvent | null {
  return events.get(id) || null
}

export function updateEventStatus(id: string, status: StoreEvent['status']): void {
  const ev = events.get(id)
  if (ev) {
    ev.status = status
    events.set(id, ev)
  }
}

export function addMember(member: StoreMember): void {
  const list = membersByEvent.get(member.event_id) || []
  const existing = list.findIndex(m => m.user_id === member.user_id)
  if (existing >= 0) {
    list[existing] = member
  } else {
    list.push(member)
  }
  membersByEvent.set(member.event_id, list)
  console.log(`[Store] Miembro agregado: ${member.display_name} → evento ${member.event_id}`)
}

export function getMembers(eventId: string): StoreMember[] {
  return membersByEvent.get(eventId) || []
}

export function savePreferences(eventId: string, userId: string, values: string[]): void {
  let list = prefsByEvent.get(eventId) || []
  list = list.filter(p => p.user_id !== userId)
  values.forEach((value, index) => {
    if (value.trim()) {
      list.push({ event_id: eventId, user_id: userId, position: index + 1, value: value.trim() })
    }
  })
  prefsByEvent.set(eventId, list)
  console.log(`[Store] Preferencias guardadas para user=${userId} en evento=${eventId}`)
}

export function getPreferences(eventId: string, userId: string): string[] {
  const list = prefsByEvent.get(eventId) || []
  return list
    .filter(p => p.user_id === userId)
    .sort((a, b) => a.position - b.position)
    .map(p => p.value)
}

export function getAllPreferences(eventId: string): StorePreference[] {
  return prefsByEvent.get(eventId) || []
}

export function getProgress(eventId: string): { total: number; completed: number; status: string } {
  const ev = events.get(eventId)
  const members = getMembers(eventId)
  const required = ev?.preference_count || 3

  let completed = 0
  for (const m of members) {
    const prefs = getPreferences(eventId, m.user_id)
    if (prefs.length >= required) completed++
  }

  return {
    total: members.length,
    completed,
    status: ev?.status || 'open',
  }
}

export function runDraw(eventId: string): StoreAssignment[] {
  const members = getMembers(eventId)
  if (members.length < 2) throw new Error('Se necesitan al menos 2 participantes.')

  let shuffled = [...members]
  let valid = false
  let attempts = 0

  while (!valid && attempts < 200) {
    attempts++
    shuffled = [...members].sort(() => Math.random() - 0.5)
    valid = members.every((m, i) => m.user_id !== shuffled[i].user_id)
  }

  if (!valid) throw new Error('No se pudo generar un sorteo válido.')

  const assignments: StoreAssignment[] = members.map((m, i) => ({
    event_id: eventId,
    giver_user_id: m.user_id,
    recipient_user_id: shuffled[i].user_id,
  }))

  assignmentsByEvent.set(eventId, assignments)
  updateEventStatus(eventId, 'drawn')

  console.log(`[Store] Sorteo realizado para evento=${eventId}: ${assignments.length} asignaciones`)
  return assignments
}

export function getMyAssignment(eventId: string, userId: string): { recipientName: string; preferences: string[] } | null {
  const assignments = assignmentsByEvent.get(eventId) || []
  const mine = assignments.find(a => a.giver_user_id === userId)
  if (!mine) return null

  const members = getMembers(eventId)
  const recipient = members.find(m => m.user_id === mine.recipient_user_id)
  if (!recipient) return null

  const prefs = getPreferences(eventId, recipient.user_id)

  return {
    recipientName: recipient.display_name,
    preferences: prefs,
  }
}

export function getAssignments(eventId: string): StoreAssignment[] {
  return assignmentsByEvent.get(eventId) || []
}
