import { NextRequest, NextResponse } from 'next/server'
import { sendEmailNotification, DrawAssignmentNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const notifications: DrawAssignmentNotification[] = body.notifications || []

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return NextResponse.json({ message: 'No hay notificaciones para enviar' }, { status: 400 })
    }

    const results = await Promise.all(
      notifications.map(async (item) => {
        if (!item.giverEmail) return { giver: item.giverName, sent: false, reason: 'sin email' }
        const res = await sendEmailNotification(item)
        return { giver: item.giverName, sent: res.success, reason: res.message }
      })
    )

    return NextResponse.json({
      success: true,
      processed: results.length,
      sentCount: results.filter((r) => r.sent).length,
      details: results,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
