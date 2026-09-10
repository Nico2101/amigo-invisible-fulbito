'use client'

import { useState } from 'react'
import { AuthUser, saveStoredUser } from '@/lib/authClient'

interface AuthCardProps {
  onSuccess: (user: AuthUser) => void
  initialTab?: 'login' | 'register'
  title?: string
  subtitle?: string
}

export function AuthCard({
  onSuccess,
  initialTab = 'login',
  title,
  subtitle,
}: AuthCardProps) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanUser = username.trim()
    const cleanPass = password.trim()

    if (!cleanUser) {
      setError('Por favor ingresá tu nombre de usuario.')
      return
    }
    if (!cleanPass) {
      setError('Por favor ingresá tu contraseña.')
      return
    }

    setBusy(true)
    const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
          display_name: displayName.trim() || cleanUser,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud.')
      }

      const authUser: AuthUser = data.user
      saveStoredUser(authUser)
      onSuccess(authUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="form-card auth-gate-card">
      <div className="auth-panel-head" style={{ marginBottom: 16 }}>
        <div className="auth-icon">⚽</div>
        <div>
          <h3 style={{ fontSize: 20, margin: 0 }}>{title || 'Tu Cuenta de Fulbito'}</h3>
          <p style={{ margin: '3px 0 0', color: '#8ca996', fontSize: 13 }}>
            {subtitle || 'Iniciá sesión para ver tus eventos o ingresar a la sala desde cualquier dispositivo.'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="auth-tabs" style={{
        display: 'flex',
        background: '#07160d',
        padding: 4,
        borderRadius: 14,
        border: '1px solid #1c4228',
        marginBottom: 20,
      }}>
        <button
          type="button"
          onClick={() => { setTab('login'); setError('') }}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: 0,
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 14,
            background: tab === 'login' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'transparent',
            color: tab === 'login' ? '#04160a' : '#88a694',
            transition: 'all .15s ease',
          }}
        >
          Iniciar Sesión
        </button>
        <button
          type="button"
          onClick={() => { setTab('register'); setError('') }}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: 0,
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 14,
            background: tab === 'register' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'transparent',
            color: tab === 'register' ? '#04160a' : '#88a694',
            transition: 'all .15s ease',
          }}
        >
          Crear Cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label>Nombre de usuario *
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Ej. leo, nico, fede"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="username"
              required
            />
          </label>
        </div>

        {tab === 'register' && (
          <div style={{ marginBottom: 14 }}>
            <label>Nombre y Apellido para mostrar (opcional)
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Ej. Nico Abritta"
                autoCapitalize="words"
                autoComplete="name"
              />
            </label>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label>Contraseña *
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>
        </div>

        {error && (
          <div style={{
            background: '#2d120f',
            border: '1px solid #732a22',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13,
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="button primary large full"
          disabled={busy}
        >
          {busy
            ? (tab === 'login' ? 'Iniciando sesión…' : 'Creando cuenta…')
            : (tab === 'login' ? 'Entrar a mi cuenta →' : 'Crear mi cuenta →')
          }
        </button>
      </form>
    </div>
  )
}
