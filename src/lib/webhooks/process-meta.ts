import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { raiseAlert } from '@/modules/alerts/raise-alert'
import { normalizeMetaPayload, type NormalizedMetaEvent } from './meta-events'

const QUALITY_EVENT_TEXT: Record<string, { severity: 'aviso' | 'critico'; text: string }> = {
  DOWNGRADE: { severity: 'critico', text: 'Meta bajó tu límite de envío por la calidad del número.' },
  FLAGGED: { severity: 'critico', text: 'Meta marcó tu número por baja calidad. Si no mejora en 7 días, bajará tu límite.' },
  UPGRADE: { severity: 'aviso', text: 'Buenas noticias: Meta subió tu límite de envío.' },
  UNFLAGGED: { severity: 'aviso', text: 'Tu número salió de la alerta de calidad de Meta.' },
}

export async function processMetaEvent(_eventType: string | null, payload: unknown) {
  for (const event of normalizeMetaPayload(payload)) {
    await applyMetaEvent(event)
  }
}

async function applyMetaEvent(event: NormalizedMetaEvent) {
  const db = supabaseAdmin()
  switch (event.type) {
    case 'quality_update': {
      const digits = (event.displayPhoneNumber ?? '').replace(/\D/g, '')
      const { data: phones } = await db
        .from('phone_numbers')
        .select('id, tenant_id, display_phone_number, phone_number_id')
        .eq('waba_id', event.wabaId ?? '')
      const phone = phones?.find((p) => (p.display_phone_number ?? '').replace(/\D/g, '') === digits) ?? phones?.[0]
      if (!phone) return
      await db
        .from('phone_numbers')
        .update({ messaging_limit: event.currentLimit, last_webhook_at: new Date().toISOString() })
        .eq('id', phone.id)
      const info = QUALITY_EVENT_TEXT[event.event] ?? { severity: 'aviso' as const, text: `Meta informó un cambio de calidad: ${event.event}.` }
      await raiseAlert({
        tenantId: phone.tenant_id,
        phoneId: phone.id,
        source: 'numero',
        severity: info.severity,
        title: 'Cambio en la calidad de tu número',
        body: `${info.text}${event.currentLimit ? ` Límite actual: ${event.currentLimit}.` : ''}`,
        dedupeKey: `quality:${phone.phone_number_id}:${event.event}:${event.currentLimit ?? ''}:${new Date().toISOString().slice(0, 10)}`,
      })
      return
    }

    case 'template_category_update': {
      const { data: tpl } = await db
        .from('templates')
        .update({ meta_category: event.newCategory, updated_at: new Date().toISOString() })
        .eq('meta_template_id', event.templateId)
        .select('id, tenant_id, name')
        .maybeSingle()
      if (!tpl) return
      await db.from('template_predictions').update({ final_meta_category: event.newCategory }).eq('template_id', tpl.id)
      if (event.previousCategory && event.previousCategory !== event.newCategory) {
        await raiseAlert({
          tenantId: tpl.tenant_id,
          source: 'meta',
          severity: event.newCategory === 'MARKETING' ? 'critico' : 'aviso',
          title: `Meta recategorizó la plantilla "${tpl.name}"`,
          body: `Pasó de ${event.previousCategory} a ${event.newCategory}. ${
            event.newCategory === 'MARKETING' ? 'Ahora cuesta como marketing y respeta las bajas de marketing.' : ''
          }`.trim(),
          dedupeKey: `tplcat:${event.templateId}:${event.newCategory}`,
        })
      }
      return
    }

    case 'template_status_update': {
      const { data: tpl } = await db
        .from('templates')
        .update({
          status: event.status,
          rejection_reason: event.reason && event.reason !== 'NONE' ? event.reason : null,
          ...(event.category ? { meta_category: event.category.toUpperCase() } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('meta_template_id', event.templateId)
        .select('id, meta_category, requested_category')
        .maybeSingle()
      // La categoría queda "final" para calibrar cuando Meta aprueba.
      if (tpl && event.status === 'APPROVED') {
        await db
          .from('template_predictions')
          .update({ final_meta_category: tpl.meta_category ?? tpl.requested_category })
          .eq('template_id', tpl.id)
      }
      return
    }

    case 'message_status': {
      if (!event.wamid) return
      await db
        .from('messages')
        .update({
          status: event.status,
          ...(event.pricingCategory ? { pricing_category: event.pricingCategory, billable: event.billable } : {}),
        })
        .eq('wamid', event.wamid)
      return
    }

    case 'ignored':
      return
  }
}
