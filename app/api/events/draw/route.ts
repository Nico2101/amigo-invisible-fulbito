import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

// POST /api/events/draw — Realizar el sorteo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[API /api/events/draw POST] Body:', JSON.stringify(body))

    const { event_id, user_id, confirm_redraw } = body

    if (!event_id || !user_id) {
      return NextResponse.json({ error: 'Faltan event_id o user_id' }, { status: 400 })
    }

    const event = await store.getEventById(event_id)
    if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    if (event.organizer_id !== user_id) {
      return NextResponse.json({ error: 'Solo el organizador puede realizar el sorteo' }, { status: 403 })
    }
    if (event.status === 'drawn' && !confirm_redraw) {
      return NextResponse.json({ error: 'El sorteo ya fue realizado. Confirmá que querés reemplazarlo.' }, { status: 400 })
    }

    const assignments = await store.runDraw(event_id)
    const members = await store.getMembers(event_id)

    // Construir info de notificaciones
    const notifications = await Promise.all(
      assignments.map(async a => {
        const giver = members.find(m => m.user_id === a.giver_user_id)
        const recipient = members.find(m => m.user_id === a.recipient_user_id)
        const prefs = recipient ? await store.getPreferences(event_id, recipient.user_id) : []

        return {
          giverName: giver?.display_name || '?',
          recipientName: recipient?.display_name || '?',
          preferences: prefs,
        }
      })
    )

    console.log(`[API /api/events/draw] ✅ Sorteo completado: ${assignments.length} asignaciones`)
    return NextResponse.json({ success: true, assignments: notifications })
  } catch (err) {
    console.error('[API /api/events/draw] ❌ Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
