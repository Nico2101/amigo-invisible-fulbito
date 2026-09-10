import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

// POST /api/events/result — Obtener mi resultado secreto
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[API /api/events/result POST] Body:', JSON.stringify(body))

    const { event_id, user_id } = body

    if (!event_id || !user_id) {
      return NextResponse.json({ error: 'Faltan event_id y user_id' }, { status: 400 })
    }

    const result = await store.getMyAssignment(event_id, user_id)
    if (!result) {
      return NextResponse.json({ error: 'No hay una asignación para este usuario.' }, { status: 404 })
    }

    const ev = await store.getEventById(event_id)

    console.log(`[API /api/events/result] ✅ Resultado para ${user_id}: ${result.recipientName}`)
    return NextResponse.json({
      ...result,
      eventName: ev?.name || 'Amigo Invisible',
      eventCode: ev?.code || '',
      eventDate: ev?.event_date || null,
      budgetMin: ev?.budget_min || 50000,
      budgetMax: ev?.budget_max || 100000,
      rules: ev?.rules || '',
      giftType: ev?.gift_type || 'Camisetas de fútbol',
    })
  } catch (err) {
    console.error('[API /api/events/result] ❌ Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET /api/events/result?event_id=...&user_id=... — También soportar GET para conveniencia
export async function GET(req: NextRequest) {
  try {
    const event_id = req.nextUrl.searchParams.get('event_id')
    const user_id = req.nextUrl.searchParams.get('user_id')

    if (!event_id || !user_id) {
      return NextResponse.json({ error: 'Faltan event_id y user_id' }, { status: 400 })
    }

    const result = await store.getMyAssignment(event_id, user_id)
    if (!result) {
      return NextResponse.json({ error: 'No hay una asignación para este usuario.' }, { status: 404 })
    }

    const ev = await store.getEventById(event_id)

    return NextResponse.json({
      ...result,
      eventName: ev?.name || 'Amigo Invisible',
      eventCode: ev?.code || '',
      eventDate: ev?.event_date || null,
      budgetMin: ev?.budget_min || 50000,
      budgetMax: ev?.budget_max || 100000,
      rules: ev?.rules || '',
      giftType: ev?.gift_type || 'Camisetas de fútbol',
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
