import 'server-only'
import { createHash } from 'node:crypto'
import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifyKapsoSignature } from './signature'

type Source = 'kapso' | 'meta'

type IngestOptions = {
  source: Source
  secret: string
  process: (eventType: string | null, payload: unknown) => Promise<void>
}

/**
 * Recibe un webhook: verifica firma, guarda el evento crudo (idempotente),
 * responde 200 enseguida y procesa después de responder para no pasar de los 10 s de Kapso.
 */
export async function ingestWebhook(request: Request, { source, secret, process }: IngestOptions): Promise<Response> {
  const raw = await request.text()
  if (!verifyKapsoSignature(raw, request.headers.get('x-webhook-signature'), secret)) {
    return Response.json({ error: 'firma inválida' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const eventType = request.headers.get('x-webhook-event')
  const idempotencyKey =
    request.headers.get('x-idempotency-key') ?? createHash('sha256').update(raw).digest('hex')
  const phoneNumberId = extractPhoneNumberId(payload)

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('webhook_events')
    .upsert(
      { source, idempotency_key: `${source}:${idempotencyKey}`, event_type: eventType, phone_number_id: phoneNumberId, payload },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    )
    .select('id')

  if (error) {
    // Sin guardar no podemos garantizar el procesamiento: pedimos reintento.
    console.error('[webhook] no se pudo guardar el evento', error.message)
    return Response.json({ error: 'almacenamiento no disponible' }, { status: 503 })
  }

  const inserted = data?.[0]?.id as number | undefined
  if (inserted === undefined) return Response.json({ ok: true, duplicate: true })

  after(async () => {
    try {
      await process(eventType, payload)
      await db.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('id', inserted)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[webhook] fallo procesando evento ${inserted}:`, message)
      await db.from('webhook_events').update({ error: message.slice(0, 1000) }).eq('id', inserted)
    }
  })

  return Response.json({ ok: true })
}

function extractPhoneNumberId(payload: unknown): string | null {
  const p = (payload ?? {}) as Record<string, unknown>
  if (typeof p.phone_number_id === 'string') return p.phone_number_id
  const entry = Array.isArray(p.entry) ? (p.entry[0] as Record<string, unknown>) : null
  const change = entry && Array.isArray(entry.changes) ? (entry.changes[0] as Record<string, unknown>) : null
  const value = (change?.value ?? {}) as Record<string, unknown>
  const metadata = (value.metadata ?? {}) as Record<string, unknown>
  return typeof metadata.phone_number_id === 'string' ? metadata.phone_number_id : null
}
