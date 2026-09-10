import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

// POST /api/events — Crear evento
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[API /api/events POST] Body recibido:', JSON.stringify(body))

    const { name, organizer_id, organizer_name, event_date } = body

    if (!name || !organizer_id || !organizer_name) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (name, organizer_id, organizer_name)' }, { status: 400 })
    }

    const code = crypto.randomUUID().slice(0, 6).toUpperCase()
    const id = crypto.randomUUID()

    const ev = store.createEvent({
      id,
      code,
      name,
      gift_type: 'Camisetas de fútbol',
      theme: 'fulbito',
      budget_min: 50000,
      budget_max: 100000,
      event_date: event_date || null,
      rules: 'Clubes internacionales y selecciones nacionales. No clubes argentinos.',
      preference_count: 3,
      status: 'open',
      organizer_id,
      created_at: new Date().toISOString(),
    })

    store.addMember({
      event_id: id,
      user_id: organizer_id,
      display_name: organizer_name,
      role: 'organizer',
      joined_at: new Date().toISOString(),
    })

    console.log(`[API /api/events POST] ✅ Evento creado: ${ev.name}, código: ${ev.code}`)
    return NextResponse.json(ev)
  } catch (err) {
    console.error('[API /api/events POST] ❌ Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET /api/events?code=ABC123 — Buscar evento por código
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    console.log(`[API /api/events GET] Buscando evento con código: ${code}`)

    if (!code) {
      return NextResponse.json({ error: 'Falta el parámetro code' }, { status: 400 })
    }

    const ev = store.getEventByCode(code)
    if (!ev) {
      console.log(`[API /api/events GET] ⚠️ No se encontró evento con código: ${code}`)
      return NextResponse.json({ error: `No se encontró ningún evento con el código ${code}` }, { status: 404 })
    }

    console.log(`[API /api/events GET] ✅ Encontrado: ${ev.name}`)
    return NextResponse.json(ev)
  } catch (err) {
    console.error('[API /api/events GET] ❌ Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
