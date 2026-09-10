import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

// POST /api/events — Crear evento
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[API /api/events POST] Body recibido:', JSON.stringify(body))

    const {
      name,
      organizer_id,
      organizer_name,
      event_date,
      budget_min,
      budget_max,
      rules,
      gift_type,
      preference_count,
    } = body

    if (!name || !organizer_id || !organizer_name) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (name, organizer_id, organizer_name)' }, { status: 400 })
    }

    const code = crypto.randomUUID().slice(0, 6).toUpperCase()
    const id = crypto.randomUUID()

    const ev = await store.createEvent({
      id,
      code,
      name: name.trim(),
      gift_type: gift_type?.trim() || 'Camisetas de fútbol',
      theme: 'fulbito',
      budget_min: Number(budget_min) > 0 ? Number(budget_min) : 50000,
      budget_max: Number(budget_max) > 0 ? Number(budget_max) : 100000,
      event_date: event_date || null,
      rules: rules?.trim() || 'Clubes internacionales y selecciones nacionales. No clubes argentinos.',
      preference_count: Number(preference_count) > 0 ? Number(preference_count) : 3,
      status: 'open',
      organizer_id,
      created_at: new Date().toISOString(),
    })

    await store.addMember({
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

// PATCH /api/events — Actualizar configuración del evento (organizador)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, user_id, ...updates } = body

    if (!id || !user_id) {
      return NextResponse.json({ error: 'Faltan id del evento y user_id' }, { status: 400 })
    }

    const ev = await store.getEventById(id)
    if (!ev) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }

    if (ev.organizer_id !== user_id) {
      return NextResponse.json({ error: 'Solo el organizador puede modificar la configuración del evento' }, { status: 403 })
    }

    if (ev.status === 'drawn') {
      return NextResponse.json({ error: 'No se puede modificar la configuración de un evento ya sorteado' }, { status: 400 })
    }

    const updated = await store.updateEventSettings(id, updates)
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[API /api/events PATCH] ❌ Error:', err)
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

    const ev = await store.getEventByCode(code)
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
