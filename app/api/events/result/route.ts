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

    const result = store.getMyAssignment(event_id, user_id)
    if (!result) {
      return NextResponse.json({ error: 'No hay una asignación para este usuario.' }, { status: 404 })
    }

    console.log(`[API /api/events/result] ✅ Resultado para ${user_id}: ${result.recipientName}`)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[API /api/events/result] ❌ Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
