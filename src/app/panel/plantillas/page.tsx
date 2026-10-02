import { CalibrationCard } from '@/components/templates/calibration-card'
import { TemplateList } from '@/components/templates/template-list'
import { TemplateStudio } from '@/components/templates/template-studio'
import { computeCalibration, type ResolvedPrediction } from '@/modules/templates/calibration'
import { requireTenant } from '@/modules/tenancy/session'

export default async function PlantillasPage() {
  const { supabase, tenant } = await requireTenant()
  const [{ data: templates }, { data: resolved }] = await Promise.all([
    supabase
      .from('templates')
      .select('id, name, requested_category, meta_category, status, rejection_reason, updated_at')
      .eq('tenant_id', tenant.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('template_predictions')
      .select('p_utility, p_marketing, p_authentication, final_meta_category')
      .eq('tenant_id', tenant.id)
      .not('final_meta_category', 'is', null),
  ])

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Estudio de plantillas</h1>
        <p className="mt-1 text-slate-600">
          Antes de enviarla a Meta te decimos en qué categoría es probable que quede y qué frases la empujan a marketing.
          Si es marketing, te lo decimos claro.
        </p>
      </header>
      <TemplateStudio />
      <div className="grid gap-6 lg:grid-cols-2">
        <TemplateList templates={templates ?? []} />
        <CalibrationCard report={computeCalibration((resolved ?? []) as ResolvedPrediction[])} />
      </div>
    </section>
  )
}
