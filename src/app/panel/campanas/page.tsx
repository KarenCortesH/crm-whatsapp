import { CampaignCard, type CampaignRow } from '@/components/campaigns/campaign-card'
import { CampaignForm } from '@/components/campaigns/campaign-form'
import { requireTenant } from '@/modules/tenancy/session'

export default async function CampanasPage() {
  const { supabase, tenant } = await requireTenant()
  const [{ data: templates }, { data: phones }, { data: campaigns }] = await Promise.all([
    supabase.from('templates').select('id, name, requested_category').eq('tenant_id', tenant.id).eq('status', 'APPROVED').order('name'),
    supabase.from('phone_numbers').select('id, display_phone_number').eq('tenant_id', tenant.id),
    supabase
      .from('campaigns')
      .select('id, name, status, risk_score, risk_report, batch_size, paused_reason, created_at, templates(name), campaign_recipients(status)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Campañas</h1>
        <p className="mt-1 text-slate-600">
          Solo a contactos con permiso, por tandas y con freno automático si baja la calidad de tu número.
        </p>
      </header>
      <CampaignForm templates={templates ?? []} phones={phones ?? []} />
      <div className="flex flex-col gap-4">
        {((campaigns ?? []) as unknown as CampaignRow[]).map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </section>
  )
}
