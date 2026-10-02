'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { templateVariables } from '@/lib/kapso/templates'
import { scoreCampaignRisk, tierToLimit } from '@/modules/campaigns/risk-score'
import { requireTenant } from '@/modules/tenancy/session'

export type CampaignState = { error?: string; ok?: string } | null

const schema = z.object({
  name: z.string().trim().min(2, 'Ponle nombre a la campaña').max(100),
  templateId: z.string().uuid('Elige una plantilla aprobada'),
  phoneId: z.string().uuid('Elige el número'),
})

const DAY = 86_400_000

/** Crea la campaña en borrador con SOLO contactos con permiso vigente y calcula el riesgo. */
export async function createCampaignAction(_prev: CampaignState, formData: FormData): Promise<CampaignState> {
  const { supabase, tenant, userId } = await requireTenant()
  const parsed = schema.safeParse({ name: formData.get('name'), templateId: formData.get('templateId'), phoneId: formData.get('phoneId') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const [{ data: template }, { data: phone }] = await Promise.all([
    supabase.from('templates').select('id, body, status, requested_category, meta_category').eq('id', parsed.data.templateId).eq('tenant_id', tenant.id).maybeSingle(),
    supabase.from('phone_numbers').select('id, quality_rating, messaging_limit, throughput_tier').eq('id', parsed.data.phoneId).eq('tenant_id', tenant.id).maybeSingle(),
  ])
  if (!template || template.status !== 'APPROVED') return { error: 'La plantilla debe estar aprobada por Meta.' }
  if (!phone) return { error: 'Número no encontrado.' }
  if (templateVariables(template.body).count > 1) {
    return { error: 'Por ahora las campañas admiten plantillas sin variables o con una sola ({{1}} = nombre del contacto).' }
  }

  const { data: eligible, error } = await supabase
    .from('contacts')
    .select('id, blocked_reports, consents!inner(granted_at, revoked_at, purpose)')
    .eq('tenant_id', tenant.id)
    .eq('marketing_opted_out', false)
    .eq('consents.purpose', 'marketing')
    .is('consents.revoked_at', null)
  if (error) return { error: 'No pudimos leer tus contactos.' }

  const recipients = (eligible ?? []) as Array<{ id: string; blocked_reports: number; consents: Array<{ granted_at: string }> }>
  if (!recipients.length) return { error: 'No tienes contactos con permiso de marketing vigente. Regístralos en Contactos.' }

  const now = Date.now()
  const consentAgesDays = recipients.map((r) => {
    const newest = Math.max(...r.consents.map((c) => new Date(c.granted_at).getTime()))
    return (now - newest) / DAY
  })
  const { data: lastCampaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('phone_id', phone.id)
    .eq('status', 'completada')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let lastCampaignFailureRate: number | null = null
  if (lastCampaign) {
    const [{ count: total }, { count: failed }] = await Promise.all([
      supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', lastCampaign.id).in('status', ['enviado', 'fallido']),
      supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', lastCampaign.id).eq('status', 'fallido'),
    ])
    lastCampaignFailureRate = total ? (failed ?? 0) / total : null
  }

  const risk = scoreCampaignRisk({
    recipients: recipients.length,
    messagingLimit: tierToLimit(phone.messaging_limit ?? phone.throughput_tier),
    qualityRating: phone.quality_rating,
    consentAgesDays,
    historicBlockRate: recipients.filter((r) => r.blocked_reports > 0).length / recipients.length,
    lastCampaignFailureRate,
  })

  const db = supabaseAdmin()
  const { data: campaign, error: cErr } = await db
    .from('campaigns')
    .insert({
      tenant_id: tenant.id,
      phone_id: phone.id,
      template_id: template.id,
      name: parsed.data.name,
      status: risk.blocked ? 'cancelada' : 'borrador',
      risk_score: risk.score,
      risk_report: risk,
      batch_size: Math.max(1, risk.recommendedBatchSize),
      paused_reason: risk.blockReason,
      created_by: userId,
    })
    .select('id')
    .single()
  if (cErr || !campaign) return { error: 'No pudimos crear la campaña.' }

  if (!risk.blocked) {
    const { error: rErr } = await db
      .from('campaign_recipients')
      .insert(recipients.map((r) => ({ tenant_id: tenant.id, campaign_id: campaign.id, contact_id: r.id })))
    if (rErr) {
      await db.from('campaigns').delete().eq('id', campaign.id)
      return { error: 'Algún contacto perdió su permiso mientras creabas la campaña. Intenta de nuevo.' }
    }
  }

  revalidatePath('/panel/campanas')
  return risk.blocked
    ? { error: risk.blockReason ?? 'Campaña bloqueada por riesgo.' }
    : { ok: `Campaña creada con ${recipients.length} contactos con permiso. Riesgo ${risk.level} (${risk.score}/100).` }
}

export async function setCampaignStatusAction(formData: FormData) {
  const { supabase, tenant } = await requireTenant()
  const id = String(formData.get('campaignId') ?? '')
  const action = String(formData.get('accion') ?? '')
  const next = { iniciar: 'enviando', pausar: 'pausada', reanudar: 'enviando', cancelar: 'cancelada' }[action]
  if (!next) return

  const { data: campaign } = await supabase.from('campaigns').select('id, status, risk_report, phone_id').eq('id', id).eq('tenant_id', tenant.id).maybeSingle()
  if (!campaign) return
  const allowed: Record<string, string[]> = {
    iniciar: ['borrador'],
    pausar: ['enviando'],
    reanudar: ['pausada'],
    cancelar: ['borrador', 'enviando', 'pausada'],
  }
  if (!allowed[action].includes(campaign.status)) return

  const patch: Record<string, unknown> = { status: next, paused_reason: action === 'pausar' ? 'Pausada por ti' : null }
  if (action === 'iniciar' || action === 'reanudar') {
    const { data: phone } = await supabase.from('phone_numbers').select('quality_rating').eq('id', campaign.phone_id).single()
    patch.risk_report = { ...(campaign.risk_report as object), quality_at_start: phone?.quality_rating ?? null }
  }
  await supabase.from('campaigns').update(patch).eq('id', id)
  revalidatePath('/panel/campanas')
}
