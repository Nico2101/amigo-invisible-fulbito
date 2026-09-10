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
  shirt_size?: string
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
  preferences?: string[]
  shirt_size?: string
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

// Bins de almacenamiento en la nube persistentes y compartidos entre todos los dispositivos y lambdas
const PRIMARY_BIN = 'https://extendsclass.com/api/json-storage/bin/fcccbca'
const BACKUP_BIN = 'https://extendsclass.com/api/json-storage/bin/aacfbac'

const IS_VERCEL = Boolean(process.env.VERCEL)
const SEED_FILE = path.join(process.cwd(), 'data', 'store.json')
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'amigo-data') : path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'store.json')

// Cache en memoria con tiempo de vida para acelerar lecturas concurrentes
let memoryCache: StoreData | null = null
let lastFetchTime = 0
const CACHE_TTL_MS = 2000 // 2 segundos

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

// Asegurar que la carpeta local exista para backup en disco
function ensureLocalDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch (err) {
    console.warn('[Store] No se pudo crear directorio local:', err)
  }
}

function saveToLocalDisk(data: StoreData): void {
  try {
    ensureLocalDir()
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[Store] Error guardando copia en disco local:', err)
  }
}

function loadFromLocalDisk(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      if (raw) return JSON.parse(raw) as StoreData
    }
    if (fs.existsSync(SEED_FILE)) {
      const raw = fs.readFileSync(SEED_FILE, 'utf-8')
      if (raw) return JSON.parse(raw) as StoreData
    }
  } catch (err) {
    console.warn('[Store] Error leyendo de disco local:', err)
  }
  return getInitialData()
}

// Carga centralizada: Consulta el store en la nube para sincronizar todos los dispositivos y lambdas
async function loadData(forceRefresh = false): Promise<StoreData> {
  const now = Date.now()
  if (!forceRefresh && memoryCache && now - lastFetchTime < CACHE_TTL_MS) {
    return memoryCache
  }

  // 1. Intentar descargar del bin principal en la nube
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    const res = await fetch(`${PRIMARY_BIN}?_ts=${now}`, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok) {
      const parsed = await res.json()
      if (parsed && typeof parsed === 'object') {
        const cloudData: StoreData = {
          users: parsed.users || {},
          events: parsed.events || {},
          eventsByCode: parsed.eventsByCode || {},
          membersByEvent: parsed.membersByEvent || {},
          prefsByEvent: parsed.prefsByEvent || {},
          assignmentsByEvent: parsed.assignmentsByEvent || {},
        }
        memoryCache = cloudData
        lastFetchTime = now
        saveToLocalDisk(cloudData)
        return cloudData
      }
    }
  } catch (err) {
    console.warn('[Store:Cloud] Bin principal no disponible, intentando backup...', err)
  }

  // 2. Intentar descargar del bin de respaldo
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${BACKUP_BIN}?_ts=${now}`, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok) {
      const parsed = await res.json()
      if (parsed && typeof parsed === 'object') {
        const cloudData: StoreData = {
          users: parsed.users || {},
          events: parsed.events || {},
          eventsByCode: parsed.eventsByCode || {},
          membersByEvent: parsed.membersByEvent || {},
          prefsByEvent: parsed.prefsByEvent || {},
          assignmentsByEvent: parsed.assignmentsByEvent || {},
        }
        memoryCache = cloudData
        lastFetchTime = now
        saveToLocalDisk(cloudData)
        return cloudData
      }
    }
  } catch {
    // Falla de red en ambos bins
  }

  // 3. Si no hay conexión o falla la nube, usar caché en memoria o disco
  if (memoryCache) return memoryCache
  const diskData = loadFromLocalDisk()
  memoryCache = diskData
  return diskData
}

// Guardado centralizado: Escribe a la nube y actualiza caché local
async function saveData(data: StoreData): Promise<void> {
  memoryCache = data
  lastFetchTime = Date.now()
  saveToLocalDisk(data)

  const payload = JSON.stringify(data)

  // Subir a la nube principal
  try {
    const res = await fetch(PRIMARY_BIN, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })
    if (!res.ok) {
      console.warn('[Store:Cloud] PUT al bin principal falló:', res.status)
      // Backup bin
      await fetch(BACKUP_BIN, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
    }
  } catch (err) {
    console.error('[Store:Cloud] Error sincronizando a la nube:', err)
    try {
      await fetch(BACKUP_BIN, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
    } catch {}
  }
}

// ---- Funciones públicas ----

export async function createEvent(ev: StoreEvent): Promise<StoreEvent> {
  const data = await loadData(true)
  const cleanCode = ev.code.trim().toUpperCase()
  data.events[ev.id] = ev
  data.eventsByCode[cleanCode] = ev.id
  await saveData(data)
  console.log(`[Store] ✅ Evento creado: "${ev.name}" (código: ${cleanCode}, id: ${ev.id})`)
  return ev
}

export async function getEventByCode(code: string): Promise<StoreEvent | null> {
  const data = await loadData(true)
  const cleanCode = (code || '').trim().toUpperCase().replace(/\s+/g, '')
  const id = data.eventsByCode[cleanCode]
  if (!id) return null
  return data.events[id] || null
}

export async function getEventById(id: string): Promise<StoreEvent | null> {
  const data = await loadData(true)
  return data.events[id] || null
}

export async function updateEventStatus(id: string, status: StoreEvent['status']): Promise<void> {
  const data = await loadData(true)
  const ev = data.events[id]
  if (ev) {
    ev.status = status
    data.events[id] = ev
    await saveData(data)
    console.log(`[Store] Estado del evento ${id} actualizado a "${status}"`)
  }
}

export async function updateEventSettings(
  id: string,
  settings: Partial<Pick<StoreEvent, 'name' | 'budget_min' | 'budget_max' | 'event_date' | 'rules' | 'gift_type' | 'preference_count'>>
): Promise<StoreEvent | null> {
  const data = await loadData(true)
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
  await saveData(data)
  console.log(`[Store] ✅ Ajustes del evento ${id} actualizados:`, settings)
  return ev
}

export async function deleteEvent(id: string, userId: string): Promise<boolean> {
  const data = await loadData(true)
  const ev = data.events[id]
  if (!ev) return false

  if (ev.organizer_id !== userId) {
    throw new Error('Solo el administrador del evento puede eliminarlo.')
  }

  // Eliminar de events
  delete data.events[id]

  // Eliminar mapeo por código
  if (ev.code && data.eventsByCode[ev.code]) {
    delete data.eventsByCode[ev.code]
  }
  for (const [c, eventId] of Object.entries(data.eventsByCode)) {
    if (eventId === id) {
      delete data.eventsByCode[c]
    }
  }

  // Eliminar miembros, preferencias y asignaciones asociadas
  delete data.membersByEvent[id]
  delete data.prefsByEvent[id]
  delete data.assignmentsByEvent[id]

  await saveData(data)
  console.log(`[Store] 🗑️ Evento ${id} (${ev.name}) eliminado completamente por el organizador ${userId}`)
  return true
}

export async function addMember(member: StoreMember): Promise<void> {
  const data = await loadData(true)
  const list = data.membersByEvent[member.event_id] || []
  const existing = list.findIndex(m => m.user_id === member.user_id)
  if (existing >= 0) {
    list[existing] = member
  } else {
    list.push(member)
  }
  data.membersByEvent[member.event_id] = list

  // Si el usuario ya tiene preferencias o talle registrados en su cuenta, aplicarlos automáticamente al evento
  const user = Object.values(data.users || {}).find(u => u.id === member.user_id)
  if (user) {
    if (user.shirt_size && !member.shirt_size) {
      member.shirt_size = user.shirt_size
    }
    if (user.preferences && user.preferences.length >= 3) {
      let eventPrefs = data.prefsByEvent[member.event_id] || []
      const hasEventPrefs = eventPrefs.some(p => p.user_id === member.user_id)
      if (!hasEventPrefs) {
        user.preferences.forEach((val, idx) => {
          if (val.trim()) {
            eventPrefs.push({ event_id: member.event_id, user_id: member.user_id, position: idx + 1, value: val.trim() })
          }
        })
        data.prefsByEvent[member.event_id] = eventPrefs
        console.log(`[Store] ✅ Preferencias heredadas automáticamente para "${member.display_name}" en evento ${member.event_id}`)
      }
    }
  }

  await saveData(data)
  console.log(`[Store] Miembro "${member.display_name}" guardado en evento ${member.event_id} (talle: ${member.shirt_size || 'N/A'})`)
}

export async function getMembers(eventId: string): Promise<StoreMember[]> {
  const data = await loadData(true)
  return data.membersByEvent[eventId] || []
}

export async function savePreferences(eventId: string, userId: string, values: string[], shirtSize?: string): Promise<void> {
  const data = await loadData(true)
  let list = data.prefsByEvent[eventId] || []
  list = list.filter(p => p.user_id !== userId)
  const cleaned: string[] = []
  values.forEach((value, index) => {
    if (value.trim()) {
      cleaned.push(value.trim())
      list.push({ event_id: eventId, user_id: userId, position: index + 1, value: value.trim() })
    }
  })
  data.prefsByEvent[eventId] = list

  const cleanSize = (shirtSize || '').trim().toUpperCase()

  // Actualizar talle de remera en el miembro del evento
  const members = data.membersByEvent[eventId] || []
  const member = members.find(m => m.user_id === userId)
  if (member && cleanSize) {
    member.shirt_size = cleanSize
  }

  // Guardar también en la cuenta del usuario para que se recuerden en todos sus eventos
  const user = Object.values(data.users || {}).find(u => u.id === userId)
  if (user) {
    if (cleaned.length >= 3) {
      user.preferences = cleaned
    }
    if (cleanSize) {
      user.shirt_size = cleanSize
    }
    data.users[user.username] = user
  }

  await saveData(data)
  console.log(`[Store] Preferencias y talle (${cleanSize}) guardados para user=${userId} en evento=${eventId} y en su cuenta:`, cleaned)
}

export async function getPreferences(eventId: string, userId: string): Promise<string[]> {
  const data = await loadData(true)
  const list = data.prefsByEvent[eventId] || []
  const currentPrefs = list
    .filter(p => p.user_id === userId)
    .sort((a, b) => a.position - b.position)
    .map(p => p.value)

  if (currentPrefs.length >= 3) {
    return currentPrefs
  }

  // Si no hay preferencias en este evento, consultar si el usuario tiene preferencias guardadas en su cuenta
  const user = Object.values(data.users || {}).find(u => u.id === userId)
  if (user && user.preferences && user.preferences.length >= 3) {
    // Heredar automáticamente a este evento
    let eventList = data.prefsByEvent[eventId] || []
    eventList = eventList.filter(p => p.user_id !== userId)
    user.preferences.forEach((val, idx) => {
      if (val.trim()) {
        eventList.push({ event_id: eventId, user_id: userId, position: idx + 1, value: val.trim() })
      }
    })
    data.prefsByEvent[eventId] = eventList
    await saveData(data)
    console.log(`[Store] ✅ Preferencias heredadas de la cuenta para user=${userId} en evento=${eventId}:`, user.preferences)
    return user.preferences
  }

  return currentPrefs
}

export async function getPreferencesAndSize(eventId: string, userId: string): Promise<{ preferences: string[]; shirt_size: string }> {
  const prefs = await getPreferences(eventId, userId)
  const data = await loadData(true)
  const members = data.membersByEvent[eventId] || []
  const member = members.find(m => m.user_id === userId)
  const user = Object.values(data.users || {}).find(u => u.id === userId)

  let size = member?.shirt_size || user?.shirt_size || ''
  if (!member?.shirt_size && user?.shirt_size && member) {
    member.shirt_size = user.shirt_size
    await saveData(data)
  }

  return {
    preferences: prefs,
    shirt_size: size,
  }
}

export async function getAllPreferences(eventId: string): Promise<StorePreference[]> {
  const data = await loadData(true)
  return data.prefsByEvent[eventId] || []
}

export async function getProgress(eventId: string): Promise<{ total: number; completed: number; status: string }> {
  const data = await loadData(true)
  const ev = data.events[eventId]
  const members = data.membersByEvent[eventId] || []
  const required = ev?.preference_count || 3

  let completed = 0
  for (const m of members) {
    const prefs = (data.prefsByEvent[eventId] || []).filter(p => p.user_id === m.user_id)
    if (prefs.length >= required) completed++
  }

  return {
    total: members.length,
    completed,
    status: ev?.status || 'open',
  }
}

export async function runDraw(eventId: string): Promise<StoreAssignment[]> {
  const data = await loadData(true)
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
  await saveData(data)

  console.log(`[Store] 🎉 Sorteo completado para evento ${eventId}: ${assignments.length} parejas`)
  return assignments
}

export async function getMyAssignment(eventId: string, userId: string): Promise<{ recipientName: string; preferences: string[]; shirtSize: string } | null> {
  const data = await loadData(true)
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

  const recipientUser = Object.values(data.users || {}).find(u => u.id === recipient.user_id)
  const shirtSize = recipient.shirt_size || recipientUser?.shirt_size || ''

  return {
    recipientName: recipient.display_name,
    preferences: prefs,
    shirtSize,
  }
}

export async function getAssignments(eventId: string): Promise<StoreAssignment[]> {
  const data = await loadData(true)
  return data.assignmentsByEvent[eventId] || []
}

export async function debugGetAll() {
  const data = await loadData(true)
  return {
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

export async function registerUser(username: string, password: string, displayName?: string): Promise<StoreUser> {
  const cleanUsername = (username || '').trim().toLowerCase()
  const cleanPassword = (password || '').trim()
  const cleanName = (displayName || '').trim() || username.trim()

  if (!cleanUsername) throw new Error('Ingresá un nombre de usuario.')
  if (!cleanPassword) throw new Error('Ingresá una contraseña.')

  const data = await loadData(true)
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
  await saveData(data)
  console.log(`[Store:Auth] ✅ Usuario registrado con éxito: "${cleanUsername}" (${id})`)
  return newUser
}

export async function loginUser(username: string, password: string): Promise<StoreUser> {
  const cleanUsername = (username || '').trim().toLowerCase()
  const cleanPassword = (password || '').trim()

  if (!cleanUsername) throw new Error('Ingresá tu nombre de usuario.')
  if (!cleanPassword) throw new Error('Ingresá tu contraseña.')

  const data = await loadData(true)
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

export async function getUserById(userId: string): Promise<StoreUser | null> {
  const data = await loadData(true)
  const found = Object.values(data.users || {}).find(u => u.id === userId)
  return found || null
}

export async function getUserEvents(userId: string): Promise<UserEventSummary[]> {
  const data = await loadData(true)
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
