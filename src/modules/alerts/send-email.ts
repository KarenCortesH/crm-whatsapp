import 'server-only'
import { serverEnv } from '@/lib/env'

/** Envía la alerta por correo con Resend. Sin RESEND_API_KEY, la alerta queda solo en el panel. */
export async function sendAlertEmail(to: string, subject: string, body: string): Promise<boolean> {
  const env = serverEnv()
  if (!env.RESEND_API_KEY || !env.ALERTS_FROM_EMAIL) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.ALERTS_FROM_EMAIL,
      to: [to],
      subject: `⚠️ ${subject}`,
      text: `${body}\n\nRevisa el detalle en ${env.APP_URL}/panel`,
    }),
  })
  if (!res.ok) console.error('[alertas] correo no enviado', res.status, await res.text())
  return res.ok
}
