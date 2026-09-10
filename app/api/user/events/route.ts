import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'Falta user_id' }, { status: 400 })
    }

    const events = await store.getUserEvents(userId)
    return NextResponse.json({ events })
  } catch (err) {
    console.error('[API /api/user/events] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener eventos del usuario' },
      { status: 500 }
    )
  }
}
