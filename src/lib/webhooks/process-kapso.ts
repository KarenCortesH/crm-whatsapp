import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { listPhoneNumbers } from '@/lib/kapso/phone-numbers'
import { ensurePhoneWebhooks } from '@/lib/kapso/webhooks'
import { raiseAlert } from '@/modules/alerts/raise-alert'
import { normalizeKapsoEvent, type NormalizedKapsoEvent } from './kapso-events'

/** Códigos de Meta que indican un problema del número o de la política (no del destinatario). */
const NUMBER_RISK_ERRORS: Record<number, string> = {
  131048: 'Meta limitó tus envíos por baja calidad (spam rate limit).',
  131049: 'Meta frenó un mensaje de marketing para cuidar la experiencia del usuario.',
  131031: 'Tu cuenta de WhatsApp Business está bloqueada.',
  368: 'Tu cuenta tiene una restricción temporal por infringir políticas.',
}

export async function processKapsoEvent(eventType: string | null, payload: unknown) {
  for (const event of normalizeKapsoEvent(eventType, payload)) {
    await applyEvent(event)
  }
}

async function applyEvent(event: NormalizedKapsoEvent) {
  const db = supabaseAdmin()
  switch (event.type) {
    case 'message': {
      const { error } = await db.rpc('ingest_message', {
        p_phone_number_id: event.phoneNumberId,
        p_wamid: event.wamid,
        p_direction: event.direction,
        p_status: event.status,
        p_contact_wa_id: event.contactWaId,
        p_contact_name: event.contactName,
        p_msg_type: event.messageType,
        p_body: event.text,
        p_sent_at: event.timestamp.toISOString(),
        p_error_code: event.errorCode,
        p_error_title: event.errorTitle,
        p_kapso_conversation_id: event.conversationId,
      })
      if (error) throw new Error(`ingest_message: ${error.message}`)

      // El 131050 (baja de marketing) lo convierte Kapso en whatsapp.contact.marketing_preference_changed.
      if (event.status === 'failed' && event.errorCode !== null) {
        const risk = NUMBER_RISK_ERRORS[event.errorCode]
        if (risk) await alertForPhone(event.phoneNumberId, `meta_error_${event.errorCode}`, risk)
      }
      return
    }

    case 'marketing_preference': {
      const { error } = await db.rpc('apply_marketing_preference', {
        p_phone_number_id: event.phoneNumberId,
        p_wa_id: event.contactWaId,
        p_stopped: event.status === 'stopped',
        p_sequence: event.sequence,
        p_occurred_at: event.occurredAt.toISOString(),
      })
      if (error) throw new Error(`apply_marketing_preference: ${error.message}`)
      return
    }

    case 'phone_connected':
      await registerConnectedPhone(event.phoneNumberId, event.customerId)
      return

    case 'ignored':
      return
  }
}

/** Alta del número tras completar el setup link: lo asocia al tenant y registra los webhooks. */
export async function registerConnectedPhone(phoneNumberId: string, kapsoCustomerId: string | null) {
  const db = supabaseAdmin()
  const env = serverEnv()
  const [info] = await listPhoneNumbers({ phoneNumberId })
  // El dueño del número lo dice Kapso, nunca el llamador (el phone_number_id puede venir de una URL).
  const customerId = info?.customer_id ?? null
  if (!customerId) throw new Error(`El número ${phoneNumberId} no tiene customer en Kapso`)
  if (kapsoCustomerId && kapsoCustomerId !== customerId) {
    throw new Error(`El número ${phoneNumberId} no pertenece al customer ${kapsoCustomerId}`)
  }

  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .select('id')
    .eq('kapso_customer_id', customerId)
    .maybeSingle()
  if (tErr) throw new Error(tErr.message)
  if (!tenant) throw new Error(`No hay tenant para el customer ${customerId}`)

  const { error } = await db.from('phone_numbers').upsert(
    {
      tenant_id: tenant.id,
      phone_number_id: phoneNumberId,
      waba_id: info?.business_account_id ?? null,
      display_phone_number: info?.display_phone_number ?? null,
      verified_name: info?.verified_name ?? null,
      is_coexistence: info?.is_coexistence ?? false,
      quality_rating: info?.quality_rating ?? null,
      throughput_tier: info?.throughput_tier ?? null,
      messaging_limit: info?.whatsapp_business_manager_messaging_limit ?? null,
      connection_status: info?.status ?? null,
    },
    { onConflict: 'phone_number_id' },
  )
  if (error) throw new Error(error.message)

  await ensurePhoneWebhooks(phoneNumberId, env.APP_URL, env.KAPSO_WEBHOOK_SECRET)
}

async function alertForPhone(phoneNumberId: string, code: string, message: string) {
  const db = supabaseAdmin()
  const { data: phone } = await db
    .from('phone_numbers')
    .select('id, tenant_id')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()
  if (!phone) return
  const day = new Date().toISOString().slice(0, 10)
  await raiseAlert({
    tenantId: phone.tenant_id,
    phoneId: phone.id,
    source: 'numero',
    severity: 'critico',
    title: 'Meta está frenando tus envíos',
    body: message,
    dedupeKey: `${code}:${phoneNumberId}:${day}`,
  })
}
