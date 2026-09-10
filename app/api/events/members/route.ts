import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

// GET /api/events/members?event_id=xxx — Obtener miembros y progreso
export async function GET(req: NextRequest) {
  try {
    const eventId = req.nextUrl.searchParams.get('event_id')
    if (!eventId) {
      return NextResponse.json({ error: 'Falta event_id' }, { status: 400 })
    }

    const members = store.getMembers(eventId)
    const progress = store.getProgress(eventId)

    // Enriquecer con estado de preferencias
    const enriched = members.map(m => ({
      ...m,
      has_preferences: store.getPreferences(eventId, m.user_id).length >= 3,
    }))

    return NextResponse.json({ members: enriched, progress })
  } catch (err) {
    console.error('[API /api/events/members] ❌ Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
