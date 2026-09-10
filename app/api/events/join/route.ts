import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

// POST /api/events/join — Unirse a un evento
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[API /api/events/join POST] Body recibido:', JSON.stringify(body))

    const { code, user_id, display_name } = body

    if (!code || !user_id || !display_name) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const ev = await store.getEventByCode(code)
    if (!ev) {
      console.log(`[API /api/events/join] ⚠️ Evento no encontrado: ${code}`)
      return NextResponse.json({ error: `No se encontró ningún evento con el código ${code}` }, { status: 404 })
    }

    await store.addMember({
      event_id: ev.id,
      user_id,
      display_name,
      role: 'participant',
      joined_at: new Date().toISOString(),
    })

    const members = await store.getMembers(ev.id)
    const prefs = await store.getPreferences(ev.id, user_id)

    console.log(`[API /api/events/join] ✅ ${display_name} se unió a ${ev.name}`)
    return NextResponse.json({ event: ev, members, myPrefs: prefs })
  } catch (err) {
    console.error('[API /api/events/join] ❌ Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
