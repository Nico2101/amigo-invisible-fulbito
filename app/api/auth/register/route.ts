import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password, display_name } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'Ingresá tu nombre de usuario y contraseña.' }, { status: 400 })
    }

    const user = await store.registerUser(username, password, display_name)

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
      },
    })
  } catch (err) {
    console.error('[API /api/auth/register] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al registrar usuario' },
      { status: 400 }
    )
  }
}
