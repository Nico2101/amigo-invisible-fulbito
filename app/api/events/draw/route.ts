import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

// POST /api/events/draw — Realizar el sorteo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[API /api/events/draw POST] Body:', JSON.stringify(body))

    const { event_id } = body

    if (!event_id) {
      return NextResponse.json({ error: 'Falta event_id' }, { status: 400 })
    }

    const assignments = store.runDraw(event_id)
    const members = store.getMembers(event_id)

    // Construir info de notificaciones
    const notifications = assignments.map(a => {
      const giver = members.find(m => m.user_id === a.giver_user_id)
      const recipient = members.find(m => m.user_id === a.recipient_user_id)
      const prefs = recipient ? store.getPreferences(event_id, recipient.user_id) : []

      return {
        giverName: giver?.display_name || '?',
        recipientName: recipient?.display_name || '?',
        preferences: prefs,
      }
    })

    console.log(`[API /api/events/draw] ✅ Sorteo completado: ${assignments.length} asignaciones`)
    return NextResponse.json({ success: true, assignments: notifications })
  } catch (err) {
    console.error('[API /api/events/draw] ❌ Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
