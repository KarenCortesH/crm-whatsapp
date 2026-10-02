import { ConnectForm } from '@/components/connect/connect-form'
import { PhoneList } from '@/components/connect/phone-list'
import { requireTenant } from '@/modules/tenancy/session'

export default async function ConectarPage() {
  const { supabase, tenant } = await requireTenant()
  const { data: phones } = await supabase
    .from('phone_numbers')
    .select('id, display_phone_number, verified_name, is_coexistence, quality_rating, connection_status')
    .eq('tenant_id', tenant.id)
    .order('created_at')

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Tu número de WhatsApp</h1>
        <p className="mt-1 text-slate-600">
          Lo conectas tú, con tu propia cuenta de Facebook. Nunca te pedimos contraseñas. A Meta le pagas con tu tarjeta.
        </p>
      </header>
      <PhoneList phones={phones ?? []} />
      <ConnectForm hasPhones={(phones ?? []).length > 0} />
    </section>
  )
}
