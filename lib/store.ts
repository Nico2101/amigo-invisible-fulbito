import fs from 'fs'
import path from 'path'
import os from 'os'

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

export interface StoreUser {
  id: string
  username: string
  password: string
  display_name: string
  created_at: string
}

export interface UserEventSummary {
  event: StoreEvent
  role: 'organizer' | 'participant'
  hasPreferences: boolean
  isDrawn: boolean
}

interface StoreData {
  users: Record<string, StoreUser> // username (lowercase) -> user
  events: Record<string, StoreEvent>
  eventsByCode: Record<string, string> // CODE -> event.id
  membersByEvent: Record<string, StoreMember[]>
  prefsByEvent: Record<string, StorePreference[]>
  assignmentsByEvent: Record<string, StoreAssignment[]>
}

const IS_VERCEL = Boolean(process.env.VERCEL)
const SEED_FILE = path.join(process.cwd(), 'data', 'store.json')
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'amigo-data') : path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'store.json')

// Cache en memoria por si el sistema de archivos es estrictamente de sólo lectura
let memoryCache: StoreData | null = null

function getInitialData(): StoreData {
  return {
    users: {},
    events: {},
    eventsByCode: {},
    membersByEvent: {},
    prefsByEvent: {},
    assignmentsByEvent: {},
  }
}

// Asegurar que la carpeta y el archivo existan siempre
function ensureFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(DATA_FILE)) {
      // Si hay archivo inicial en el bundle, copiarlo
      if (fs.existsSync(SEED_FILE)) {
        try {
          const seedContent = fs.readFileSync(SEED_FILE, 'utf-8')
          fs.writeFileSync(DATA_FILE, seedContent, 'utf-8')
          return
        } catch {
          // Ignorar si falla lectura de seed
        }
      }
      const initial = getInitialData()
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8')
    }
  } catch (err) {
    console.error('[Store] Error asegurando archivo de datos:', err)
  }
}

function loadData(): StoreData {
  if (memoryCache) {
    return memoryCache
  }
  ensureFile()
  try {
    let raw = ''
    if (fs.existsSync(DATA_FILE)) {
      raw = fs.readFileSync(DATA_FILE, 'utf-8')
    } else if (fs.existsSync(SEED_FILE)) {
      raw = fs.readFileSync(SEED_FILE, 'utf-8')
    }
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreData>
      memoryCache = {
        users: parsed.users || {},
        events: parsed.events || {},
        eventsByCode: parsed.eventsByCode || {},
        membersByEvent: parsed.membersByEvent || {},
        prefsByEvent: parsed.prefsByEvent || {},
        assignmentsByEvent: parsed.assignmentsByEvent || {},
      }
      return memoryCache
    }
  } catch (err) {
    console.error('[Store] Error leyendo archivo de datos:', err)
  }
  memoryCache = getInitialData()
  return memoryCache
}

function saveData(data: StoreData): void {
  memoryCache = data
  ensureFile()
  try {
    const tempFile = `${DATA_FILE}.tmp`
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tempFile, DATA_FILE)
  } catch {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    } catch (writeErr) {
      console.warn('[Store] Sistema de archivos no escribible (usando memoria):', writeErr)
    }
  }
}

// ---- Funciones públicas ----

export function createEvent(ev: StoreEvent): StoreEvent {
  const data = loadData()
  const cleanCode = ev.code.trim().toUpperCase()
  data.events[ev.id] = ev
  data.eventsByCode[cleanCode] = ev.id
  saveData(data)
  console.log(`[Store:File] ✅ Evento guardado en disco: "${ev.name}" (código: ${cleanCode}, id: ${ev.id})`)
  return ev
}

export function getEventByCode(code: string): StoreEvent | null {
  const data = loadData()
  const cleanCode = (code || '').trim().toUpperCase().replace(/\s+/g, '')
  const id = data.eventsByCode[cleanCode]
  console.log(`[Store:File] Buscando código "${cleanCode}". Códigos disponibles en disco:`, Object.keys(data.eventsByCode))
  if (!id) return null
  return data.events[id] || null
}

export function getEventById(id: string): StoreEvent | null {
  const data = loadData()
  return data.events[id] || null
}

export function updateEventStatus(id: string, status: StoreEvent['status']): void {
  const data = loadData()
  const ev = data.events[id]
  if (ev) {
    ev.status = status
    data.events[id] = ev
    saveData(data)
    console.log(`[Store:File] Estado del evento ${id} actualizado a "${status}"`)
  }
}

export function updateEventSettings(
  id: string,
  settings: Partial<Pick<StoreEvent, 'name' | 'budget_min' | 'budget_max' | 'event_date' | 'rules' | 'gift_type' | 'preference_count'>>
): StoreEvent | null {
  const data = loadData()
  const ev = data.events[id]
  if (!ev) return null

  if (settings.name !== undefined && settings.name.trim()) ev.name = settings.name.trim()
  if (settings.budget_min !== undefined) ev.budget_min = Number(settings.budget_min)
  if (settings.budget_max !== undefined) ev.budget_max = Number(settings.budget_max)
  if (settings.event_date !== undefined) ev.event_date = settings.event_date
  if (settings.rules !== undefined) ev.rules = settings.rules
  if (settings.gift_type !== undefined) ev.gift_type = settings.gift_type
  if (settings.preference_count !== undefined) ev.preference_count = Number(settings.preference_count)

  data.events[id] = ev
  saveData(data)
  console.log(`[Store:File] ✅ Ajustes del evento ${id} actualizados:`, settings)
  return ev
}

export function addMember(member: StoreMember): void {
  const data = loadData()
  const list = data.membersByEvent[member.event_id] || []
  const existing = list.findIndex(m => m.user_id === member.user_id)
  if (existing >= 0) {
    list[existing] = member
  } else {
    list.push(member)
  }
  data.membersByEvent[member.event_id] = list
  saveData(data)
  console.log(`[Store:File] Miembro "${member.display_name}" guardado en evento ${member.event_id}`)
}

export function getMembers(eventId: string): StoreMember[] {
  const data = loadData()
  return data.membersByEvent[eventId] || []
}

export function savePreferences(eventId: string, userId: string, values: string[]): void {
  const data = loadData()
  let list = data.prefsByEvent[eventId] || []
  list = list.filter(p => p.user_id !== userId)
  values.forEach((value, index) => {
    if (value.trim()) {
      list.push({ event_id: eventId, user_id: userId, position: index + 1, value: value.trim() })
    }
  })
  data.prefsByEvent[eventId] = list
  saveData(data)
  console.log(`[Store:File] Preferencias guardadas para user=${userId} en evento=${eventId}`)
}

export function getPreferences(eventId: string, userId: string): string[] {
  const data = loadData()
  const list = data.prefsByEvent[eventId] || []
  return list
    .filter(p => p.user_id === userId)
    .sort((a, b) => a.position - b.position)
    .map(p => p.value)
}

export function getAllPreferences(eventId: string): StorePreference[] {
  const data = loadData()
  return data.prefsByEvent[eventId] || []
}

export function getProgress(eventId: string): { total: number; completed: number; status: string } {
  const data = loadData()
  const ev = data.events[eventId]
  const members = data.membersByEvent[eventId] || []
  const required = ev?.preference_count || 3

  let completed = 0
  for (const m of members) {
    const prefs = (data.prefsByEvent[eventId] || [])
      .filter(p => p.user_id === m.user_id)
    if (prefs.length >= required) completed++
  }

  return {
    total: members.length,
    completed,
    status: ev?.status || 'open',
  }
}

export function runDraw(eventId: string): StoreAssignment[] {
  const data = loadData()
  const members = data.membersByEvent[eventId] || []
  if (members.length < 2) throw new Error('Se necesitan al menos 2 participantes.')

  let shuffled = [...members]
  let valid = false
  let attempts = 0

  while (!valid && attempts < 200) {
    attempts++
    shuffled = [...members].sort(() => Math.random() - 0.5)
    valid = members.every((m, i) => m.user_id !== shuffled[i].user_id)
  }

  if (!valid) throw new Error('No se pudo generar un sorteo válido. Intentá nuevamente.')

  const assignments: StoreAssignment[] = members.map((m, i) => ({
    event_id: eventId,
    giver_user_id: m.user_id,
    recipient_user_id: shuffled[i].user_id,
  }))

  data.assignmentsByEvent[eventId] = assignments
  if (data.events[eventId]) {
    data.events[eventId].status = 'drawn'
  }
  saveData(data)

  console.log(`[Store:File] 🎉 Sorteo completado para evento ${eventId}: ${assignments.length} parejas`)
  return assignments
}

export function getMyAssignment(eventId: string, userId: string): { recipientName: string; preferences: string[] } | null {
  const data = loadData()
  const assignments = data.assignmentsByEvent[eventId] || []
  const mine = assignments.find(a => a.giver_user_id === userId)
  if (!mine) return null

  const members = data.membersByEvent[eventId] || []
  const recipient = members.find(m => m.user_id === mine.recipient_user_id)
  if (!recipient) return null

  const prefs = (data.prefsByEvent[eventId] || [])
    .filter(p => p.user_id === recipient.user_id)
    .sort((a, b) => a.position - b.position)
    .map(p => p.value)

  return {
    recipientName: recipient.display_name,
    preferences: prefs,
  }
}

export function getAssignments(eventId: string): StoreAssignment[] {
  const data = loadData()
  return data.assignmentsByEvent[eventId] || []
}

export function debugGetAll() {
  const data = loadData()
  return {
    dataFile: DATA_FILE,
    eventCount: Object.keys(data.events).length,
    codes: data.eventsByCode,
    events: Object.values(data.events),
    members: data.membersByEvent,
    preferences: data.prefsByEvent,
    assignments: data.assignmentsByEvent,
    users: Object.values(data.users || {}).map(u => ({ id: u.id, username: u.username, display_name: u.display_name })),
  }
}

// ---- Funciones de Usuario y Autenticación ----

export function registerUser(username: string, password: string, displayName?: string): StoreUser {
  const cleanUsername = (username || '').trim().toLowerCase()
  const cleanPassword = (password || '').trim()
  const cleanName = (displayName || '').trim() || username.trim()

  if (!cleanUsername) throw new Error('Ingresá un nombre de usuario.')
  if (!cleanPassword) throw new Error('Ingresá una contraseña.')

  const data = loadData()
  if (!data.users) data.users = {}

  if (data.users[cleanUsername]) {
    throw new Error('El usuario ya existe. Elegí otro o iniciá sesión.')
  }

  const id = `usr_${cleanUsername}`
  const newUser: StoreUser = {
    id,
    username: cleanUsername,
    password: cleanPassword,
    display_name: cleanName,
    created_at: new Date().toISOString(),
  }

  data.users[cleanUsername] = newUser
  saveData(data)
  console.log(`[Store:Auth] ✅ Usuario registrado con éxito: "${cleanUsername}" (${id})`)
  return newUser
}

export function loginUser(username: string, password: string): StoreUser {
  const cleanUsername = (username || '').trim().toLowerCase()
  const cleanPassword = (password || '').trim()

  if (!cleanUsername) throw new Error('Ingresá tu nombre de usuario.')
  if (!cleanPassword) throw new Error('Ingresá tu contraseña.')

  const data = loadData()
  const user = data.users?.[cleanUsername]

  if (!user) {
    throw new Error('Ese usuario no existe. Por favor registrate primero.')
  }

  if (user.password !== cleanPassword) {
    throw new Error('Contraseña incorrecta.')
  }

  console.log(`[Store:Auth] ✅ Inicio de sesión exitoso: "${cleanUsername}"`)
  return user
}

export function getUserById(userId: string): StoreUser | null {
  const data = loadData()
  const found = Object.values(data.users || {}).find(u => u.id === userId)
  return found || null
}

export function getUserEvents(userId: string): UserEventSummary[] {
  const data = loadData()
  const results: UserEventSummary[] = []

  for (const [eventId, members] of Object.entries(data.membersByEvent || {})) {
    const member = members.find(m => m.user_id === userId)
    if (member) {
      const event = data.events[eventId]
      if (event) {
        const prefs = (data.prefsByEvent[eventId] || []).filter(p => p.user_id === userId)
        const hasPreferences = prefs.length >= (event.preference_count || 3)
        results.push({
          event,
          role: member.role,
          hasPreferences,
          isDrawn: event.status === 'drawn',
        })
      }
    }
  }

  // Ordenar los más recientes primero
  results.sort((a, b) => new Date(b.event.created_at).getTime() - new Date(a.event.created_at).getTime())
  return results
}
