import { NextRequest, NextResponse } from 'next/server'
import * as store from '@/lib/store'

async function requireOrganizer(eventId: string, userId: string) {
  const event = await store.getEventById(eventId)
  if (!event) throw new Error('Evento no encontrado.')
  if (event.organizer_id !== userId) throw new Error('Solo el organizador puede configurar el sorteo.')
  return event
}

// Estas marcas son privadas: solo el organizador las ve y las modifica.
export async function GET(req: NextRequest) {
  try {
    const eventId = req.nextUrl.searchParams.get('event_id')
    const userId = req.nextUrl.searchParams.get('user_id')
    if (!eventId || !userId) {
      return NextResponse.json({ error: 'Faltan event_id o user_id.' }, { status: 400 })
    }

    await requireOrganizer(eventId, userId)
    const members = await store.getMembers(eventId)
    return NextResponse.json({
      settings: members.map(member => ({
        user_id: member.user_id,
        skip_giving: Boolean(member.skip_giving),
        skip_receiving: Boolean(member.skip_receiving),
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: message.includes('Solo el organizador') ? 403 : 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { event_id, user_id, member_id, skip_giving, skip_receiving } = await req.json()
    if (!event_id || !user_id || !member_id || typeof skip_giving !== 'boolean' || typeof skip_receiving !== 'boolean') {
      return NextResponse.json({ error: 'Faltan datos de configuración del sorteo.' }, { status: 400 })
    }

    await requireOrganizer(event_id, user_id)
    const member = await store.updateMemberDrawExclusions(event_id, member_id, { skip_giving, skip_receiving })
    return NextResponse.json({
      user_id: member.user_id,
      skip_giving: Boolean(member.skip_giving),
      skip_receiving: Boolean(member.skip_receiving),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: message.includes('Solo el organizador') ? 403 : 500 })
  }
}
