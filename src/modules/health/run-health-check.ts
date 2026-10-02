import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPhoneHealth } from '@/lib/kapso/phone-numbers'
import { KapsoApiError } from '@/lib/kapso/http'
import type { KapsoHealthCheck } from '@/lib/kapso/types'
import { raiseAlert } from '@/modules/alerts/raise-alert'
import { diagnoseHealth, SOURCE_LABEL, type HealthReport } from './diagnose'

type PhoneRow = {
  id: string
  tenant_id: string
  phone_number_id: string
  last_inbound_at: string | null
  last_webhook_at: string | null
}

export async function runHealthChecks(now = new Date(), tenantId?: string) {
  const db = supabaseAdmin()
  let query = db.from('phone_numbers').select('id, tenant_id, phone_number_id, last_inbound_at, last_webhook_at')
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data: phones, error } = await query
  if (error) throw new Error(error.message)

  const results: Array<{ phone: string; color: string }> = []
  for (const phone of (phones ?? []) as PhoneRow[]) {
    const report = await checkOne(phone, now)
    results.push({ phone: phone.phone_number_id, color: report.color })
  }
  return results
}

async function checkOne(phone: PhoneRow, now: Date): Promise<HealthReport> {
  const db = supabaseAdmin()
  let check: KapsoHealthCheck | null = null
  let checkError: string | undefined
  try {
    check = await checkPhoneHealth(phone.phone_number_id)
  } catch (err) {
    checkError = err instanceof KapsoApiError ? `HTTP ${err.status}` : 'sin conexión'
  }

  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString()
  const [{ count: sent }, { count: failed }] = await Promise.all([
    db.from('messages').select('id', { count: 'exact', head: true }).eq('phone_id', phone.id).eq('direction', 'outbound').gte('sent_at', since),
    db.from('messages').select('id', { count: 'exact', head: true }).eq('phone_id', phone.id).eq('direction', 'outbound').eq('status', 'failed').gte('sent_at', since),
  ])

  const report = diagnoseHealth({
    check,
    checkError,
    now,
    lastInboundAt: phone.last_inbound_at ? new Date(phone.last_inbound_at) : null,
    lastWebhookAt: phone.last_webhook_at ? new Date(phone.last_webhook_at) : null,
    sent24h: sent ?? 0,
    failed24h: failed ?? 0,
  })

  await db.from('health_snapshots').insert({
    tenant_id: phone.tenant_id,
    phone_id: phone.id,
    color: report.color,
    quality_rating: report.qualityRating,
    throughput_tier: report.throughputTier,
    messaging: report.messaging,
    findings: report.findings,
    headline: report.headline,
    checked_at: now.toISOString(),
  })

  if (check) {
    await db
      .from('phone_numbers')
      .update({
        quality_rating: report.qualityRating,
        throughput_tier: report.throughputTier,
        connection_status: check.checks.phone_number_connection?.details?.status ?? null,
      })
      .eq('id', phone.id)
  }

  const day = now.toISOString().slice(0, 10)
  for (const f of report.findings) {
    await raiseAlert({
      tenantId: phone.tenant_id,
      phoneId: phone.id,
      source: f.source,
      severity: f.severity,
      title: `${SOURCE_LABEL[f.source]}: revisa tu canal de WhatsApp`,
      body: f.message,
      dedupeKey: `health:${phone.phone_number_id}:${f.code}:${day}`,
    })
  }
  return report
}
