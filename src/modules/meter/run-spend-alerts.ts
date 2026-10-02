import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatUsd } from '@/lib/format'
import { raiseAlert } from '@/modules/alerts/raise-alert'
import { loadMeter } from './load-meter'
import { monthPeriod } from './compute-meter'

/** Recorre los tenants con tope y avisa una sola vez por umbral (50/80/100 %) y por mes. */
export async function runSpendAlerts(now = new Date()) {
  const db = supabaseAdmin()
  const { data: tenants, error } = await db.from('tenants').select('id, monthly_spend_cap_usd').not('monthly_spend_cap_usd', 'is', null)
  if (error) throw new Error(error.message)

  const period = monthPeriod(now)
  let sent = 0
  for (const t of tenants ?? []) {
    const cap = Number(t.monthly_spend_cap_usd)
    const report = await loadMeter(db, t.id, cap, now)
    for (const threshold of report.thresholdsReached) {
      const { data: inserted } = await db
        .from('spend_alerts_sent')
        .upsert({ tenant_id: t.id, period, threshold }, { onConflict: 'tenant_id,period,threshold', ignoreDuplicates: true })
        .select('threshold')
      if (!inserted?.length) continue
      sent++
      await raiseAlert({
        tenantId: t.id,
        source: 'consumo',
        severity: threshold >= 100 ? 'critico' : 'aviso',
        title: `Llevas el ${threshold}% de tu tope de gasto en Meta`,
        body: `Este mes van ${formatUsd(report.totalUsd)} de ${formatUsd(cap)}. Proyección a fin de mes: ${formatUsd(report.projectedUsd)}. Este dinero lo cobra Meta a tu tarjeta; nosotros no cobramos recargo.${report.missingRates ? ' (Hay mensajes sin tarifa cargada: el valor real puede ser mayor.)' : ''}`,
        dedupeKey: `spend:${period}:${threshold}`,
      })
    }
  }
  return { tenants: tenants?.length ?? 0, alertsSent: sent }
}
