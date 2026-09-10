import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'Ingresá tu nombre de usuario y contraseña.' }, { status: 400 })
    }

    const user = await store.loginUser(username, password)

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
      },
    })
  } catch (err) {
    console.error('[API /api/auth/login] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al iniciar sesión' },
      { status: 400 }
    )
  }
}
