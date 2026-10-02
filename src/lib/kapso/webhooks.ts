import { kapsoFetch } from './http'
import type { KapsoData, KapsoPage, KapsoWebhook } from './types'

export const KAPSO_EVENTS = [
  'whatsapp.message.received',
  'whatsapp.message.sent',
  'whatsapp.message.delivered',
  'whatsapp.message.read',
  'whatsapp.message.failed',
  'whatsapp.conversation.created',
  'whatsapp.conversation.ended',
  'whatsapp.contact.marketing_preference_changed',
] as const

export async function listWebhooks(phoneNumberId: string) {
  const res = await kapsoFetch<KapsoPage<KapsoWebhook>>({
    path: `/platform/v1/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}/webhooks`,
  })
  return res.data
}

type RegisterInput = { phoneNumberId: string; url: string; secret: string; kind: 'kapso' | 'meta' }

export async function registerWebhook({ phoneNumberId, url, secret, kind }: RegisterInput) {
  const res = await kapsoFetch<KapsoData<KapsoWebhook>>({
    method: 'POST',
    path: `/platform/v1/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}/webhooks`,
    body: {
      whatsapp_webhook: {
        url,
        kind,
        secret_key: secret,
        events: kind === 'kapso' ? [...KAPSO_EVENTS] : [],
        active: true,
        buffer_enabled: false,
      },
    },
  })
  return res.data
}

/** Registra los dos webhooks del número si aún no existen. Idempotente. */
export async function ensurePhoneWebhooks(phoneNumberId: string, appUrl: string, secret: string) {
  const existing = await listWebhooks(phoneNumberId)
  const targets = [
    { kind: 'kapso' as const, url: `${appUrl}/api/webhooks/kapso` },
    { kind: 'meta' as const, url: `${appUrl}/api/webhooks/meta` },
  ]
  const created: KapsoWebhook[] = []
  for (const t of targets) {
    const already = existing.some((w) => w.kind === t.kind && w.url === t.url)
    if (!already) created.push(await registerWebhook({ phoneNumberId, secret, ...t }))
  }
  return { existing, created }
}
