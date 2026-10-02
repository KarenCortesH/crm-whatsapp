import Link from 'next/link'
import { AlertList } from '@/components/health/alert-list'
import { FailedSendsList } from '@/components/health/failed-sends-list'
import { HealthCard } from '@/components/health/health-card'
import { RecheckButton } from '@/components/health/recheck-button'
import { requireTenant } from '@/modules/tenancy/session'

export default async function SaludPage() {
  const { supabase, tenant } = await requireTenant()

  const [{ data: phones }, { data: alerts }, { data: failed }] = await Promise.all([
    supabase
      .from('phone_numbers')
      .select('id, display_phone_number, quality_rating, throughput_tier, messaging_limit, last_inbound_at, last_webhook_at, is_coexistence')
      .eq('tenant_id', tenant.id)
      .order('created_at'),
    supabase
      .from('alerts')
      .select('id, source, severity, title, body, created_at, read_at, channels')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('messages')
      .select('id, body, error_code, error_title, sent_at, contacts(wa_id, name)')
      .eq('tenant_id', tenant.id)
      .eq('status', 'failed')
      .order('sent_at', { ascending: false })
      .limit(10),
  ])

  const snapshots = await Promise.all(
    (phones ?? []).map(async (p) => {
      const { data } = await supabase
        .from('health_snapshots')
        .select('color, headline, findings, checked_at, messaging')
        .eq('phone_id', p.id)
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return { phone: p, snapshot: data }
    }),
  )

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Salud del canal</h1>
          <p className="text-slate-600">{tenant.name}</p>
        </div>
        {snapshots.length > 0 && <RecheckButton />}
      </header>

      {snapshots.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="font-medium">Aún no hay un número conectado.</p>
          <Link href="/panel/conectar" className="mt-3 inline-block rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">
            Conectar mi número
          </Link>
        </div>
      )}

      {snapshots.map(({ phone, snapshot }) => (
        <HealthCard key={phone.id} phone={phone} snapshot={snapshot} />
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <AlertList alerts={alerts ?? []} />
        <FailedSendsList messages={(failed ?? []) as unknown as FailedMessage[]} />
      </div>
    </section>
  )
}

type FailedMessage = {
  id: string
  body: string | null
  error_code: number | null
  error_title: string | null
  sent_at: string
  contacts: { wa_id: string; name: string | null } | null
}
