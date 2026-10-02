import 'server-only'
import { serverEnv } from '@/lib/env'
import { sendTemplate } from '@/lib/kapso/messages'

/**
 * Avisa al dueño por WhatsApp desde el número de la plataforma (no desde el del cliente,
 * que puede ser justo el que está fallando). Requiere una plantilla de utilidad aprobada
 * con dos variables: {{1}} título y {{2}} detalle.
 */
export async function sendAlertWhatsApp(to: string, title: string, body: string): Promise<boolean> {
  const env = serverEnv()
  if (!env.ALERTS_PHONE_NUMBER_ID || !env.ALERTS_TEMPLATE_NAME) return false
  try {
    await sendTemplate(env.ALERTS_PHONE_NUMBER_ID, to.replace(/\D/g, ''), {
      name: env.ALERTS_TEMPLATE_NAME,
      language: env.ALERTS_TEMPLATE_LANGUAGE,
      bodyParams: [
        { type: 'text', text: title.slice(0, 60) },
        { type: 'text', text: body.slice(0, 500) },
      ],
    })
    return true
  } catch (err) {
    console.error('[alertas] WhatsApp no enviado', err instanceof Error ? err.message : err)
    return false
  }
}
