export type NormalizedKapsoEvent =
  | {
      type: 'message'
      phoneNumberId: string
      direction: 'inbound' | 'outbound'
      status: string
      wamid: string
      contactWaId: string | null
      contactName: string | null
      messageType: string
      text: string | null
      timestamp: Date
      errorCode: number | null
      errorTitle: string | null
      conversationId: string | null
    }
  | {
      type: 'marketing_preference'
      phoneNumberId: string
      contactWaId: string
      status: 'stopped' | 'resumed'
      sequence: number
      occurredAt: Date
    }
  | { type: 'phone_connected'; phoneNumberId: string; customerId: string | null }
  | { type: 'ignored'; reason: string }

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

export function normalizeKapsoEvent(eventName: string | null, payload: unknown): NormalizedKapsoEvent[] {
  const event = eventName ?? ''
  // Con buffering, Kapso entrega lotes; aceptamos ambos formatos.
  const items = Array.isArray(obj(payload).data) ? (obj(payload).data as unknown[]) : [payload]
  return items.map((item) => normalizeOne(event, obj(item)))
}

function normalizeOne(event: string, p: Json): NormalizedKapsoEvent {
  if (event === 'whatsapp.phone_number.created') {
    const phoneNumberId = str(p.phone_number_id) ?? str(obj(p.phone_number).phone_number_id)
    if (!phoneNumberId) return { type: 'ignored', reason: 'phone_number.created sin phone_number_id' }
    return { type: 'phone_connected', phoneNumberId, customerId: str(obj(p.customer).id) }
  }

  if (event === 'whatsapp.contact.marketing_preference_changed') {
    const pref = obj(p.marketing_preference)
    const status = str(pref.status)
    const waId = str(obj(p.contact).wa_id)
    const phoneNumberId = str(p.phone_number_id)
    if (!waId || !phoneNumberId || (status !== 'stopped' && status !== 'resumed')) {
      return { type: 'ignored', reason: 'preferencia de marketing incompleta' }
    }
    return {
      type: 'marketing_preference',
      phoneNumberId,
      contactWaId: waId,
      status,
      sequence: Number(pref.sequence ?? 0),
      occurredAt: new Date(str(pref.occurred_at) ?? Date.now()),
    }
  }

  if (event.startsWith('whatsapp.message.')) {
    const m = obj(p.message)
    const k = obj(m.kapso)
    const conv = obj(p.conversation)
    const phoneNumberId = str(p.phone_number_id) ?? str(conv.phone_number_id)
    const wamid = str(m.id)
    if (!phoneNumberId || !wamid) return { type: 'ignored', reason: 'mensaje sin id o número' }
    const direction = str(k.direction) === 'outbound' ? 'outbound' : 'inbound'
    const statuses = Array.isArray(k.statuses) ? (k.statuses as Json[]) : []
    const lastError = obj((statuses.findLast((s) => Array.isArray(s.errors))?.errors as unknown[] | undefined)?.[0])
    const ts = Number(str(m.timestamp) ?? NaN)
    return {
      type: 'message',
      phoneNumberId,
      direction,
      status: str(k.status) ?? event.replace('whatsapp.message.', ''),
      wamid,
      contactWaId: direction === 'inbound' ? str(m.from) ?? str(conv.phone_number) : str(m.to) ?? str(conv.phone_number),
      contactName: str(conv.contact_name),
      messageType: str(m.type) ?? 'unknown',
      text: str(obj(m.text).body) ?? str(k.content),
      timestamp: Number.isFinite(ts) ? new Date(ts * 1000) : new Date(),
      errorCode: typeof lastError.code === 'number' ? lastError.code : null,
      errorTitle: str(lastError.title) ?? str(lastError.message),
      conversationId: str(conv.id),
    }
  }

  return { type: 'ignored', reason: `evento no manejado: ${event || '(sin nombre)'}` }
}
