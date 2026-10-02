import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPhoneHealth } from '@/lib/kapso/phone-numbers'
import { sendTemplate } from '@/lib/kapso/messages'
import { KapsoApiError } from '@/lib/kapso/http'
import { templateVariables } from '@/lib/kapso/templates'
import { raiseAlert } from '@/modules/alerts/raise-alert'
import { shouldPauseCampaign } from './batch-brake'

type CampaignRow = {
  id: string
  tenant_id: string
  name: string
  batch_size: number
  risk_report: { quality_at_start?: string | null } | null
  phone_numbers: { id: string; phone_number_id: string; quality_rating: string | null }
  templates: { name: string; language: string; body: string }
}

/** Envía UNA tanda por campaña activa. Se llama desde cron; entre tandas revisa la salud del número. */
export async function runCampaignBatches() {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('campaigns')
    .select('id, tenant_id, name, batch_size, risk_report, phone_numbers(id, phone_number_id, quality_rating), templates(name, language, body)')
    .eq('status', 'enviando')
  if (error) throw new Error(error.message)

  const summary: Array<{ campaign: string; sent: number; failed: number; paused?: string; done?: boolean }> = []
  for (const c of (data ?? []) as unknown as CampaignRow[]) {
    summary.push(await runOne(c))
  }
  return summary
}

async function runOne(c: CampaignRow) {
  const db = supabaseAdmin()

  // Calidad actual: preferimos el dato fresco de Meta; si falla, la última conocida.
  let qualityNow = c.phone_numbers.quality_rating
  try {
    const health = await checkPhoneHealth(c.phone_numbers.phone_number_id)
    qualityNow = health.checks.phone_number_access?.details?.quality_rating ?? qualityNow
  } catch {
    // seguimos con el último valor guardado
  }

  const { data: lastBatchRow } = await db
    .from('campaign_recipients')
    .select('batch_no')
    .eq('campaign_id', c.id)
    .neq('status', 'pendiente')
    .order('batch_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  const lastBatch = lastBatchRow?.batch_no ?? 0

  if (lastBatch > 0) {
    const { data: prev } = await db
      .from('campaign_recipients')
      .select('status, wamid')
      .eq('campaign_id', c.id)
      .eq('batch_no', lastBatch)
      .in('status', ['enviado', 'fallido'])
    const rows = prev ?? []
    const wamids = rows.map((r) => r.wamid).filter((w): w is string => Boolean(w))
    // Fallos asíncronos: Meta acepta el envío y luego lo reporta como fallido por webhook.
    const { count: asyncFailed } = wamids.length
      ? await db.from('messages').select('id', { count: 'exact', head: true }).in('wamid', wamids).eq('status', 'failed')
      : { count: 0 }
    const brake = shouldPauseCampaign({
      qualityAtStart: c.risk_report?.quality_at_start ?? null,
      qualityNow,
      batchSent: rows.length,
      batchFailed: rows.filter((r) => r.status === 'fallido').length + (asyncFailed ?? 0),
    })
    if (brake.pause) return pause(c, brake.reason!)
  } else if (qualityNow === 'RED') {
    return pause(c, 'La calidad del número está en ROJO. Campaña pausada.')
  }

  const { data: pending } = await db
    .from('campaign_recipients')
    .select('id, contact_id, contacts(wa_id, name)')
    .eq('campaign_id', c.id)
    .eq('status', 'pendiente')
    .limit(c.batch_size)
  const batch = (pending ?? []) as unknown as Array<{ id: string; contact_id: string; contacts: { wa_id: string; name: string | null } }>
  if (!batch.length) {
    await db.from('campaigns').update({ status: 'completada' }).eq('id', c.id)
    return { campaign: c.id, sent: 0, failed: 0, done: true }
  }

  const batchNo = lastBatch + 1
  const usesName = templateVariables(c.templates.body).count === 1
  let sent = 0
  let failed = 0
  for (const r of batch) {
    const { data: hasConsent } = await db.rpc('has_marketing_consent', { c: r.contact_id })
    if (hasConsent !== true) {
      await db.from('campaign_recipients').update({ status: 'omitido', batch_no: batchNo, error: 'Sin permiso vigente' }).eq('id', r.id)
      continue
    }
    try {
      const res = await sendTemplate(c.phone_numbers.phone_number_id, r.contacts.wa_id, {
        name: c.templates.name,
        language: c.templates.language,
        bodyParams: usesName ? [{ type: 'text', text: r.contacts.name?.split(' ')[0] || 'cliente' }] : undefined,
      })
      // El trigger vuelve a exigir permiso vigente al marcar "enviado".
      await db.from('campaign_recipients').update({ status: 'enviado', batch_no: batchNo, wamid: res.messages?.[0]?.id ?? null }).eq('id', r.id)
      sent++
    } catch (err) {
      failed++
      const detail = err instanceof KapsoApiError ? JSON.stringify(err.body).slice(0, 300) : String(err)
      const optedOut = err instanceof KapsoApiError && err.status === 422
      await db
        .from('campaign_recipients')
        .update({ status: optedOut ? 'omitido' : 'fallido', batch_no: batchNo, error: optedOut ? 'Baja de marketing' : detail })
        .eq('id', r.id)
    }
  }
  return { campaign: c.id, sent, failed }
}

async function pause(c: CampaignRow, reason: string) {
  const db = supabaseAdmin()
  await db.from('campaigns').update({ status: 'pausada', paused_reason: reason }).eq('id', c.id)
  await raiseAlert({
    tenantId: c.tenant_id,
    phoneId: c.phone_numbers.id,
    source: 'campana',
    severity: 'critico',
    title: `Pausamos la campaña "${c.name}"`,
    body: reason,
    dedupeKey: `campaign-pause:${c.id}:${reason.slice(0, 40)}`,
  })
  return { campaign: c.id, sent: 0, failed: 0, paused: reason }
}
