export type MetaTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'

export type NormalizedMetaEvent =
  | {
      type: 'quality_update'
      wabaId: string | null
      displayPhoneNumber: string | null
      event: string
      currentLimit: string | null
    }
  | {
      type: 'template_category_update'
      templateId: string
      templateName: string | null
      language: string | null
      previousCategory: string | null
      newCategory: string
    }
  | {
      type: 'template_status_update'
      templateId: string
      templateName: string | null
      language: string | null
      status: string
      reason: string | null
      category: string | null
    }
  | {
      type: 'message_status'
      phoneNumberId: string
      wamid: string
      status: string
      recipient: string | null
      billable: boolean
      pricingCategory: string | null
      pricingType: string | null
      timestamp: Date
    }
  | { type: 'ignored'; reason: string }

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : typeof v === 'number' ? String(v) : null

/** Normaliza el payload crudo que Meta envía (reenviado por Kapso con kind=meta). */
export function normalizeMetaPayload(payload: unknown): NormalizedMetaEvent[] {
  const out: NormalizedMetaEvent[] = []
  for (const entry of arr(obj(payload).entry)) {
    const wabaId = str(obj(entry).id)
    for (const change of arr(obj(entry).changes)) {
      const field = str(obj(change).field)
      const value = obj(obj(change).value)
      out.push(...normalizeChange(field, value, wabaId))
    }
  }
  return out.length ? out : [{ type: 'ignored', reason: 'payload de Meta sin cambios' }]
}

function normalizeChange(field: string | null, v: Json, wabaId: string | null): NormalizedMetaEvent[] {
  switch (field) {
    case 'phone_number_quality_update':
      return [
        {
          type: 'quality_update',
          wabaId,
          displayPhoneNumber: str(v.display_phone_number),
          event: str(v.event) ?? 'UNKNOWN',
          currentLimit: str(v.current_limit) ?? str(v.max_daily_conversations_per_business),
        },
      ]
    case 'template_category_update': {
      const templateId = str(v.message_template_id)
      const newCategory = str(v.new_category) ?? str(v.correct_category)
      if (!templateId || !newCategory) return [{ type: 'ignored', reason: 'template_category_update incompleto' }]
      return [
        {
          type: 'template_category_update',
          templateId,
          templateName: str(v.message_template_name),
          language: str(v.message_template_language),
          previousCategory: str(v.previous_category),
          newCategory: newCategory.toUpperCase(),
        },
      ]
    }
    case 'message_template_status_update': {
      const templateId = str(v.message_template_id)
      if (!templateId) return [{ type: 'ignored', reason: 'message_template_status_update sin id' }]
      return [
        {
          type: 'template_status_update',
          templateId,
          templateName: str(v.message_template_name),
          language: str(v.message_template_language),
          status: str(v.event) ?? 'UNKNOWN',
          reason: str(v.reason),
          category: str(v.message_template_category),
        },
      ]
    }
    case 'messages': {
      const phoneNumberId = str(obj(v.metadata).phone_number_id)
      if (!phoneNumberId) return []
      return arr(v.statuses).map((raw): NormalizedMetaEvent => {
        const s = obj(raw)
        const pricing = obj(s.pricing)
        const ts = Number(str(s.timestamp) ?? NaN)
        return {
          type: 'message_status',
          phoneNumberId,
          wamid: str(s.id) ?? '',
          status: str(s.status) ?? 'unknown',
          recipient: str(s.recipient_id),
          billable: pricing.billable === true,
          pricingCategory: str(pricing.category),
          pricingType: str(pricing.type),
          timestamp: Number.isFinite(ts) ? new Date(ts * 1000) : new Date(),
        }
      })
    }
    default:
      return [{ type: 'ignored', reason: `campo de Meta no manejado: ${field ?? '(vacío)'}` }]
  }
}
