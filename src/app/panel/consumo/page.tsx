import { AlertSettingsForm } from '@/components/meter/alert-settings-form'
import { CategoryTable } from '@/components/meter/category-table'
import { MeterSummary } from '@/components/meter/meter-summary'
import { loadMeter } from '@/modules/meter/load-meter'
import { requireTenant } from '@/modules/tenancy/session'

export default async function ConsumoPage() {
  const { supabase, tenant, role } = await requireTenant()
  const cap = tenant.monthly_spend_cap_usd === null ? null : Number(tenant.monthly_spend_cap_usd)
  const report = await loadMeter(supabase, tenant.id, cap)

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Consumo de Meta</h1>
        <p className="mt-1 text-slate-600">
          Lo que Meta te cobra este mes, directo a tu tarjeta y al costo. Nosotros no cobramos recargo por mensaje.
        </p>
      </header>
      <MeterSummary report={report} />
      <CategoryTable lines={report.lines} />
      {report.missingRates && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Hay mensajes enviados a países sin tarifa cargada: el gasto real puede ser mayor que el mostrado.
        </p>
      )}
      {role === 'owner' && (
        <AlertSettingsForm cap={cap} alertEmail={tenant.alert_email} alertWhatsapp={tenant.alert_whatsapp} />
      )}
    </section>
  )
}
