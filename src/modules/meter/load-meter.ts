import type { SupabaseClient } from '@supabase/supabase-js'
import { computeMeter, countryFromWaId, type DeliveredMessage, type MeterReport, type PricingCategory, type RateTable } from './compute-meter'

/** Meta usa variantes ("marketing_lite", "authentication_international"); se agrupan en las 4 categorías. */
export function toPricingCategory(raw: string | null): PricingCategory | null {
  if (!raw) return null
  const c = raw.toLowerCase()
  if (c.startsWith('marketing')) return 'marketing'
  if (c.startsWith('authentication')) return 'authentication'
  if (c.startsWith('utility')) return 'utility'
  if (c.startsWith('service')) return 'service'
  return null
}

export async function loadMeter(db: SupabaseClient, tenantId: string, capUsd: number | null, now = new Date()): Promise<MeterReport> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const [{ data: rows, error }, { data: rateRows }] = await Promise.all([
    db
      .from('messages')
      .select('phone_id, pricing_category, contacts(wa_id)')
      .eq('tenant_id', tenantId)
      .eq('direction', 'outbound')
      .in('status', ['delivered', 'read'])
      .not('pricing_category', 'is', null)
      .gte('sent_at', start)
      .limit(50000),
    db.from('meta_rates').select('country_code, category, usd_per_message, effective_from').lte('effective_from', now.toISOString().slice(0, 10)).order('effective_from'),
  ])
  if (error) throw new Error(error.message)

  const messages: DeliveredMessage[] = []
  for (const r of (rows ?? []) as unknown as Array<{ phone_id: string; pricing_category: string; contacts: { wa_id: string } | null }>) {
    const category = toPricingCategory(r.pricing_category)
    if (!category) continue
    messages.push({ phoneId: r.phone_id, category, country: countryFromWaId(r.contacts?.wa_id ?? '') })
  }

  const rates: RateTable = {}
  for (const r of (rateRows ?? []) as Array<{ country_code: string; category: PricingCategory; usd_per_message: number }>) {
    rates[r.country_code] = { ...rates[r.country_code], [r.category]: Number(r.usd_per_message) }
  }

  return computeMeter({ messages, rates, now, capUsd })
}
