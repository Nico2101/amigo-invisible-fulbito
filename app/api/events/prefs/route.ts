import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

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
    console.error('[API /api/events/prefs] ❌ Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
