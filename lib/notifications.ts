export interface DrawAssignmentNotification {
  giverName: string
  giverEmail?: string
  giverPhone?: string
  recipientName: string
  preferences: string[]
  eventName: string
  eventCode: string
}

export function generateWhatsAppLink(
  giverName: string,
  recipientName: string,
  preferences: string[],
  eventName: string,
  eventCode: string,
  shirtSize?: string,
  phone?: string
): string {
  const prefsText =
    preferences.length > 0
      ? preferences.map((p, i) => `   ${i + 1}. ${p}`).join('\n')
      : '   (Sin restricciones indicadas)'

  const sizeText = shirtSize ? `👕 *Talle de remera:* ${shirtSize}\n\n` : ''

  const text =
    `⚽ *Amigo Invisible · ${eventName}*\n\n` +
    `¡Hola *${giverName}*! Ya se realizó el sorteo.\n\n` +
    `🎁 Te tocó regalarle a: *${recipientName}*\n\n` +
    sizeText +
    `🚫 *Camisetas NO deseadas por ${recipientName}:*\n${prefsText}\n\n` +
    `💰 *Presupuesto sugerido:* $50.000 - $100.000\n` +
    `🤫 *Mantené el secreto en el grupo.*\n\n` +
    `¡Que lo disfrutes!`

  const encodedText = encodeURIComponent(text)
  const cleanPhone = phone ? phone.replace(/\D/g, '') : ''

  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`
}

export function generateInviteWhatsAppLink(
  eventName: string,
  eventCode: string,
  siteUrl: string,
  budgetMin?: number,
  budgetMax?: number,
  eventDate?: string | null,
  rules?: string
): string {
  const cleanUrl = siteUrl ? siteUrl.replace(/\/+$/, '') : ''
  const directLink = `${cleanUrl}/evento/${eventCode}`

  let budgetText = ''
  if (budgetMin && budgetMax) {
    budgetText = `💰 *Presupuesto:* $${budgetMin.toLocaleString('es-AR')} – $${budgetMax.toLocaleString('es-AR')}\n`
  }

  let dateText = ''
  if (eventDate) {
    dateText = `📅 *Fecha de entrega:* ${new Date(`${eventDate}T12:00:00`).toLocaleDateString('es-AR')}\n`
  }

  let rulesText = ''
  if (rules) {
    rulesText = `📌 *Reglas:* ${rules}\n`
  }

  const text =
    `⚽ *¡Amigo Invisible Fulbito Iniciado!* ⚽\n\n` +
    `¡Muchachos! Se armó el sorteo para *${eventName}*.\n\n` +
    budgetText +
    dateText +
    rulesText +
    `\n` +
    `👉 *Sumate directamente al plantel con este link:*\n` +
    `${directLink}\n\n` +
    `*(Iniciás sesión con tu usuario y contraseña, o creás tu cuenta en 1 paso para sincronizar tus camisetas en cualquier dispositivo)*\n\n` +
    `¡No te cuelgues!`

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
}

export function generateGroupWhatsAppLink(
  eventName: string,
  eventCode: string,
  siteUrl: string
): string {
  const cleanUrl = siteUrl ? siteUrl.replace(/\/+$/, '') : ''
  const directLink = `${cleanUrl}/evento/${eventCode}`

  const text =
    `⚽ *¡Sorteo Realizado! - ${eventName}* ⚽\n\n` +
    `El sorteo del Amigo Invisible ya está listo.\n\n` +
    `Entren a ver a quién le regalan con este link directo:\n` +
    `👉 ${directLink}\n\n` +
    `¡Recuerden mantener el secreto en el grupo!`

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
}

export async function sendEmailNotification(
  notification: DrawAssignmentNotification
): Promise<{ success: boolean; message?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !notification.giverEmail) {
    return { success: false, message: 'No hay API key de Resend o email de destino' }
  }

  const prefsListHtml =
    notification.preferences.length > 0
      ? notification.preferences.map((p) => `<li style="margin-bottom:6px;">❌ <strong>${p}</strong></li>`).join('')
      : '<li>Sin preferencias registradas</li>'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #07110c; color: #f6fff8; padding: 20px;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #0d1b13; border: 1px solid #1f3a28; border-radius: 16px; padding: 24px;">
          <h2 style="color: #47e58a; margin-top: 0;">⚽ Amigo Invisible · Fulbito</h2>
          <p style="font-size: 16px; color: #d0e4d6;">¡Hola <strong>${notification.giverName}</strong>!</p>
          <p style="font-size: 15px; color: #a9beb0;">Se ha realizado el sorteo de <strong>${notification.eventName}</strong>.</p>
          
          <div style="background-color: #11271a; border: 1px solid #2b5b3b; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
            <span style="font-size: 12px; color: #8da79a; text-transform: uppercase; letter-spacing: 1px;">Te toca regalarle a</span>
            <h1 style="color: #f4f0df; font-size: 28px; margin: 8px 0;">🎁 ${notification.recipientName}</h1>
          </div>

          <div style="background-color: #08140d; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <h4 style="color: #47e58a; margin-top: 0; margin-bottom: 10px;">🚫 Camisetas NO Deseadas:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #cddbd1;">
              ${prefsListHtml}
            </ul>
          </div>

          <p style="font-size: 13px; color: #82988b; margin-bottom: 0;">Presupuesto sugerido: <strong>$50.000 - $100.000</strong>. ¡Mantené el misterio!</p>
        </div>
      </body>
    </html>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Amigo Invisible Fulbito <onboarding@resend.dev>',
        to: [notification.giverEmail],
        subject: `⚽ Tu amigo invisible es ${notification.recipientName} - ${notification.eventName}`,
        html,
      }),
    })

    if (!res.ok) {
      const errData = await res.json()
      return { success: false, message: errData.message || 'Error al enviar mail' }
    }

    return { success: true }
  } catch (err) {
    return { success: false, message: String(err) }
  }
}
