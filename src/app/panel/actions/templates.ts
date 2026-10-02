'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createMetaTemplate, templateVariables, toTemplateName } from '@/lib/kapso/templates'
import { KapsoApiError } from '@/lib/kapso/http'
import { gradeTemplate } from '@/modules/templates/grade-template'
import { createCategoryScorer, createTemplateAnalyzer } from '@/modules/templates/providers/create-providers'
import type { TemplateCategory, TemplateGrade } from '@/modules/templates/types'
import { requireTenant } from '@/modules/tenancy/session'

export type StudioState = {
  error?: string
  ok?: string
  grade?: TemplateGrade
  predictionId?: string
  draft?: { name: string; body: string; requestedCategory: TemplateCategory; examples: string }
} | null

const draftSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre a la plantilla').max(100),
  body: z.string().trim().min(5, 'Escribe el texto de la plantilla').max(1024, 'Máximo 1.024 caracteres'),
  requestedCategory: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
  examples: z.string().default(''),
})

function readDraft(formData: FormData) {
  return draftSchema.safeParse({
    name: formData.get('name'),
    body: formData.get('body'),
    requestedCategory: formData.get('requestedCategory'),
    examples: formData.get('examples') ?? '',
  })
}

export async function gradeTemplateAction(_prev: StudioState, formData: FormData): Promise<StudioState> {
  const { tenant } = await requireTenant()
  const parsed = readDraft(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const draft = parsed.data

  const vars = templateVariables(draft.body)
  if (!vars.valid) return { error: 'Las variables deben ir en orden: {{1}}, {{2}}, {{3}}…', draft }

  let grade: TemplateGrade
  try {
    grade = await gradeTemplate(
      { name: draft.name, body: draft.body, requestedCategory: draft.requestedCategory, businessContext: tenant.name },
      createTemplateAnalyzer(),
      createCategoryScorer(),
    )
  } catch (err) {
    console.error('[plantillas] calificador falló', err)
    return { error: 'Somos nosotros: el calificador no respondió. Intenta de nuevo en un momento.', draft }
  }

  const { data, error } = await supabaseAdmin()
    .from('template_predictions')
    .insert({
      tenant_id: tenant.id,
      body_text: draft.body,
      provider: grade.probabilitySource,
      model: grade.models.join(' + '),
      p_utility: round3(grade.probabilities.utility),
      p_marketing: round3(grade.probabilities.marketing),
      p_authentication: round3(grade.probabilities.authentication),
      verdict: grade.verdict,
      marketing_phrases: grade.marketingPhrases,
      suggested_rewrite: grade.suggestedRewrite,
    })
    .select('id')
    .single()
  if (error) console.error('[plantillas] no se guardó la predicción', error.message)

  return { grade, predictionId: data?.id, draft }
}

export async function submitTemplateAction(_prev: StudioState, formData: FormData): Promise<StudioState> {
  const { tenant, supabase } = await requireTenant()
  const parsed = readDraft(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const draft = parsed.data
  const predictionId = String(formData.get('predictionId') ?? '')

  const db = supabaseAdmin()
  const { data: prediction } = await db
    .from('template_predictions')
    .select('id, verdict, body_text')
    .eq('id', predictionId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!prediction || prediction.body_text !== draft.body) {
    return { error: 'Califica la plantilla otra vez: el texto cambió desde la última revisión.', draft }
  }
  // Nunca disfrazamos marketing de utilidad.
  if (prediction.verdict === 'marketing' && draft.requestedCategory !== 'MARKETING') {
    return { error: 'Esta plantilla es marketing. Cambia la categoría a Marketing para enviarla.', draft }
  }

  const { data: phone } = await supabase
    .from('phone_numbers')
    .select('waba_id')
    .eq('tenant_id', tenant.id)
    .not('waba_id', 'is', null)
    .limit(1)
    .maybeSingle()
  if (!phone?.waba_id) return { error: 'Conecta tu número antes de enviar plantillas a Meta.', draft }

  const vars = templateVariables(draft.body)
  const examples = draft.examples.split(',').map((s) => s.trim()).filter(Boolean)
  if (examples.length !== vars.count) {
    return { error: `Meta pide un ejemplo por variable: tienes ${vars.count} variables y ${examples.length} ejemplos.`, draft }
  }

  const name = toTemplateName(draft.name)
  try {
    const created = await createMetaTemplate({
      wabaId: phone.waba_id,
      name,
      language: 'es',
      category: draft.requestedCategory,
      body: draft.body,
      examples,
    })
    const { data: tpl } = await db
      .from('templates')
      .upsert(
        {
          tenant_id: tenant.id,
          name,
          language: 'es',
          body: draft.body,
          requested_category: draft.requestedCategory,
          meta_template_id: created.id,
          meta_category: created.category ?? null,
          status: created.status ?? 'PENDING',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,name,language' },
      )
      .select('id')
      .single()
    if (tpl) {
      await db
        .from('template_predictions')
        .update({ template_id: tpl.id })
        .eq('id', prediction.id)
    }
  } catch (err) {
    const detail = err instanceof KapsoApiError ? metaErrorMessage(err.body) : null
    console.error('[plantillas] Meta rechazó la creación', err)
    return { error: `Meta no aceptó la plantilla${detail ? `: ${detail}` : '.'}`, draft }
  }

  revalidatePath('/panel/plantillas')
  return { ok: `Enviada a Meta como ${draft.requestedCategory}. Te avisamos cuando la revisen.` }
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

function metaErrorMessage(body: unknown): string | null {
  const err = (body as { error?: { error_user_msg?: string; message?: string } } | null)?.error
  return err?.error_user_msg ?? err?.message ?? null
}
