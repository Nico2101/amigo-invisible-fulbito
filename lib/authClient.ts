'use client'

export interface AuthUser {
  id: string
  username: string
  display_name: string
  preferences?: string[]
}

const AUTH_STORAGE_KEY = 'amigo_user_account.v2'

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AuthUser
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
  return null
}

export function saveStoredUser(user: AuthUser): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  } catch (err) {
    console.error('Error guardando sesión:', err)
  }
}

export function clearStoredUser(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem('amigo-invisible.user-session.v5')
  } catch (err) {
    console.error('Error cerrando sesión:', err)
  }
}
