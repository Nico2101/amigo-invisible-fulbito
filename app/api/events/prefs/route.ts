import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

// GET /api/events/prefs?event_id=xxx&user_id=yyy — Obtener preferencias de un usuario
export async function GET(req: NextRequest) {
  try {
    const event_id = req.nextUrl.searchParams.get('event_id')
    const user_id = req.nextUrl.searchParams.get('user_id')

    if (!event_id || !user_id) {
      return NextResponse.json({ error: 'Faltan event_id y user_id' }, { status: 400 })
    }

    const prefs = await store.getPreferences(event_id, user_id)
    return NextResponse.json(prefs)
  } catch (err) {
    console.error('[API /api/events/prefs GET] ❌ Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/events/prefs — Guardar preferencias
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[API /api/events/prefs POST] Body:', JSON.stringify(body))

    const { event_id, user_id, preferences } = body

    if (!event_id || !user_id || !Array.isArray(preferences)) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    await store.savePreferences(event_id, user_id, preferences)
    const progress = await store.getProgress(event_id)

    console.log(`[API /api/events/prefs] ✅ Preferencias guardadas. Progreso: ${progress.completed}/${progress.total}`)
    return NextResponse.json({ success: true, progress })
  } catch (err) {
    console.error('[API /api/events/prefs POST] ❌ Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
