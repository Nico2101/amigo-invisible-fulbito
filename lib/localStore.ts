export interface LocalEventData {
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

export interface LocalMemberData {
  event_id: string
  user_id: string
  display_name: string
  role: 'organizer' | 'participant'
  joined_at: string
  email?: string
  phone?: string
  has_preferences?: boolean
}

export function saveLocalEvent(event: LocalEventData): void {
  try {
    const key = `amigo_event_${event.code.toUpperCase()}`
    localStorage.setItem(key, JSON.stringify(event))
    const listKey = 'amigo_events_list'
    const existing = JSON.parse(localStorage.getItem(listKey) || '[]')
    if (!existing.includes(event.code.toUpperCase())) {
      existing.push(event.code.toUpperCase())
      localStorage.setItem(listKey, JSON.stringify(existing))
    }
  } catch (e) {
    console.error('[LocalStore] Error guardando evento local:', e)
  }
}

export function getLocalEvent(code: string): LocalEventData | null {
  try {
    const raw = localStorage.getItem(`amigo_event_${code.toUpperCase()}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveLocalMember(member: LocalMemberData): void {
  try {
    const key = `amigo_members_${member.event_id}`
    const members: LocalMemberData[] = JSON.parse(localStorage.getItem(key) || '[]')
    const idx = members.findIndex((m) => m.user_id === member.user_id)
    if (idx >= 0) {
      members[idx] = { ...members[idx], ...member }
    } else {
      members.push(member)
    }
    localStorage.setItem(key, JSON.stringify(members))
  } catch (e) {
    console.error('[LocalStore] Error guardando miembro local:', e)
  }
}

export function getLocalMembers(eventId: string): LocalMemberData[] {
  try {
    return JSON.parse(localStorage.getItem(`amigo_members_${eventId}`) || '[]')
  } catch {
    return []
  }
}

export function saveLocalPreferences(eventId: string, userId: string, prefs: string[]): void {
  try {
    const key = `amigo_prefs_${eventId}_${userId}`
    localStorage.setItem(key, JSON.stringify(prefs))
  } catch (e) {
    console.error('[LocalStore] Error guardando preferencias locales:', e)
  }
}

export function getLocalPreferences(eventId: string, userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`amigo_prefs_${eventId}_${userId}`) || '[]')
  } catch {
    return []
  }
}

export function saveLocalAssignments(eventId: string, assignments: { giver_user_id: string; recipient_user_id: string }[]): void {
  try {
    localStorage.setItem(`amigo_assignments_${eventId}`, JSON.stringify(assignments))
  } catch (e) {
    console.error('[LocalStore] Error guardando asignaciones locales:', e)
  }
}

export function getLocalAssignments(eventId: string): { giver_user_id: string; recipient_user_id: string }[] {
  try {
    return JSON.parse(localStorage.getItem(`amigo_assignments_${eventId}`) || '[]')
  } catch {
    return []
  }
}
